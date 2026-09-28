// Orkestrator run workflow. Tidak tahu soal HTTP; semua kejadian dikirim lewat `emit(event)`.
//
// Aturan:
// - Node siap jalan kalau semua edge masuk (non-loop) sudah selesai/di-skip dan minimal satu edge aktif.
//   Semua edge masuk tidak aktif → node di-skip (cabang yang tidak dipilih condition).
// - condition/approval memilih edge `when: true` atau `when: false`.
// - Edge dengan `loop: N` mengulang node tujuan + semua node di bawahnya, maksimal N kali.
import { BRANCHING_TYPES, WORK_TYPES, ancestors, chosenEdges, downstream, incoming, readyNodes } from './graph.js';
import { EXECUTORS } from './executors.js';

const RESET_FIELDS = {
  endedAt: undefined, error: undefined, warning: undefined, usage: undefined, cost: undefined,
  changes: undefined, diff: undefined, touched: undefined,
};

export class WorkflowRun {
  // tracker: { snapshot(workdir), changes(workdir, base, head) } untuk menghitung file yang diubah tiap node.
  constructor({ id, wf, agents, actions = [], input, workdir, runners, emit, tracker = null }) {
    this.id = id;
    this.wf = wf;
    this.agents = Object.fromEntries(agents.map((a) => [a.name, a]));
    this.actions = Object.fromEntries(actions.map((a) => [a.name, a]));
    this.tracker = tracker;
    this.input = input;
    this.workdir = workdir;
    this.runners = runners;
    this.emit = (e) => emit({ ts: Date.now(), run: id, ...e });
    this.nodes = Object.fromEntries(wf.nodes.map((n) => [n.id, n]));
    this.state = Object.fromEntries(wf.nodes.map((n) => [n.id, { status: 'pending', attempts: 0 }]));
    this.active = new Set(); // index edge yang aktif
    this.loopCount = {};
    this.feedback = {};
    this.touched = {};
    this.running = new Map();
    this.approvals = new Map();
    this.cost = 0;
    this.stopped = false;
    this.status = 'pending';
    this.error = null;
  }

  // ---- state (selalu diganti objek baru, tidak dimutasi) ----

  setNode(id, patch) {
    this.state = { ...this.state, [id]: { ...this.state[id], ...patch } };
    this.emit({ type: 'node', node: id, ...patch });
  }

  addCost(amount = 0) {
    this.cost += amount ?? 0;
    this.emit({ type: 'cost', total: this.cost });
    if (this.wf.budget_usd && this.cost > this.wf.budget_usd) {
      this.fail(`Budget workflow $${this.wf.budget_usd} terlampaui ($${this.cost.toFixed(2)})`);
    }
  }

  recordActivity(nodeId, activity) {
    if (activity.file) this.touched = { ...this.touched, [nodeId]: [...new Set([...(this.touched[nodeId] ?? []), activity.file])] };
    this.emit({ type: 'activity', node: nodeId, ...activity });
  }

  registerApproval(nodeId, resolve) {
    this.approvals.set(nodeId, (decision) => {
      this.approvals.delete(nodeId);
      resolve(decision);
    });
  }

  // ---- kueri untuk eksekutor ----

  incomingOf(id) {
    return incoming(this.wf, id);
  }

  upstreamOutputs(node, mode) {
    if (mode === 'none') return [];
    const ids = Array.isArray(mode) ? mode : mode === 'all' ? ancestors(this.wf, node.id) : this.incomingOf(node.id).map((e) => e.from);
    return ids
      .map((id) => this.nodes[id])
      .filter((n) => n && WORK_TYPES.has(n.type) && this.state[n.id].status === 'done' && this.state[n.id].output)
      .map((n) => ({ node: n, output: this.state[n.id].output }));
  }

  infoFor(id) {
    return this.incomingOf(id)
      .map((e) => this.nodes[e.from])
      .filter((n) => n.type === 'info' && n.text)
      .map((n) => n.text);
  }

  // ---- siklus hidup run ----

  async start() {
    this.status = 'running';
    if (!this.input) this.input = this.wf.nodes.find((n) => n.type === 'start' && n.input)?.input ?? '';
    this.emit({ type: 'run_start', workflow: this.wf.name, input: this.input, workdir: this.workdir });
    try {
      await this.loop();
    } catch (err) {
      this.fail(err.message);
    }
    if (this.status === 'running') {
      const failed = Object.values(this.state).some((s) => s.status === 'failed');
      this.status = this.stopped ? 'stopped' : failed ? 'failed' : 'done';
    }
    this.emit({ type: 'run_end', status: this.status, cost: this.cost, error: this.error ?? undefined });
    return this.status;
  }

  fail(message) {
    this.status = 'failed';
    this.error = message;
    this.stopped = true;
  }

  stop() {
    this.stopped = true;
    this.status = 'stopped';
    for (const { abort } of this.running.values()) abort.abort();
    for (const resolve of this.approvals.values()) resolve({ approved: false, note: 'run dihentikan' });
  }

  approve(nodeId, approved, note = '') {
    const resolve = this.approvals.get(nodeId);
    if (!resolve) throw new Error(`Node ${nodeId} tidak sedang menunggu persetujuan`);
    resolve({ approved, note });
  }

  startNode(node) {
    const abort = new AbortController();
    const promise = this.execute(node, abort.signal)
      .catch((err) => this.onNodeError(node, err))
      .finally(() => this.running.delete(node.id));
    this.running.set(node.id, { promise, abort });
  }

  async loop() {
    const limit = Math.max(1, Number(this.wf.parallel) || 3);
    while (!this.stopped) {
      for (const { node, skip } of readyNodes(this.wf, this.state, this.active)) {
        if (skip) this.setNode(node.id, { status: 'skipped' });
        else if (this.running.size < limit) this.startNode(node);
      }
      // Skip bisa membuka node lain; ulangi sebelum menunggu kalau masih ada yang bisa dijalankan.
      const pending = readyNodes(this.wf, this.state, this.active);
      if (pending.some((r) => r.skip) || (pending.length && this.running.size < limit)) continue;
      if (!this.running.size) break;
      await Promise.race([...this.running.values()].map((r) => r.promise));
    }
    await Promise.allSettled([...this.running.values()].map((r) => r.promise));
  }

  onNodeError(node, err) {
    if (this.stopped && this.status === 'stopped') {
      this.setNode(node.id, { status: 'stopped' });
      return;
    }
    this.setNode(node.id, { status: 'failed', error: err.message, activity: null });
    this.fail(`${node.label || node.id} gagal: ${err.message}`);
  }

  async trackedChanges(base) {
    if (!base) return {};
    const head = await this.tracker.snapshot(this.workdir).catch(() => null);
    if (!head) return {};
    const changes = await this.tracker.changes(this.workdir, base, head).catch(() => undefined);
    return { diff: { base, head }, changes };
  }

  async execute(node, signal) {
    const startedAt = Date.now();
    this.setNode(node.id, { ...RESET_FIELDS, status: 'running', startedAt });
    this.touched = { ...this.touched, [node.id]: [] };
    const tracked = WORK_TYPES.has(node.type) && this.tracker;
    const base = tracked ? await this.tracker.snapshot(this.workdir).catch(() => null) : null;
    const executor = EXECUTORS[node.type] ?? EXECUTORS.agent;
    const result = await executor(this, node, signal);
    if (this.stopped && this.status === 'stopped') {
      this.setNode(node.id, { status: 'stopped', activity: null });
      return;
    }
    const touched = this.touched[node.id] ?? [];
    this.setNode(node.id, {
      status: 'done',
      ...(await this.trackedChanges(base)),
      touched: touched.length ? touched : undefined,
      endedAt: Date.now(),
      durationMs: Date.now() - startedAt,
      output: result.output,
      verdict: result.verdict,
      reason: result.reason,
      cost: result.cost,
      usage: result.usage,
      turns: result.turns,
      warning: result.warning,
      exitCode: result.exitCode,
      activity: null,
    });
    this.followEdges(node, BRANCHING_TYPES.has(node.type) ? result.verdict : undefined);
  }

  followEdges(node, verdict) {
    let resetSelf = false;
    for (const e of chosenEdges(this.wf, node.id, verdict)) {
      if (e.loop) resetSelf = this.triggerLoop(e, node.id) || resetSelf;
      else this.active = new Set([...this.active, e.i]);
    }
    if (resetSelf) this.setNode(node.id, { status: 'pending' });
  }

  // Mengulang node tujuan loop beserta semua turunannya. Mengembalikan true kalau node asal ikut di-reset.
  triggerLoop(edge, fromId) {
    const key = `${edge.from}->${edge.to}`;
    const count = (this.loopCount[key] ?? 0) + 1;
    if (count > edge.loop) throw new Error(`Batas loop ${key} (${edge.loop}x) habis dan masih belum lolos`);
    this.loopCount = { ...this.loopCount, [key]: count };
    const reset = downstream(this.wf, edge.to);
    this.active = new Set([...this.active].filter((i) => !reset.has(this.wf.edges[i].from)));
    const source = this.nodes[fromId].source ?? this.incomingOf(fromId)[0]?.from;
    this.feedback = {
      ...this.feedback,
      [edge.to]: {
        attempt: count + 1,
        from: this.nodes[source]?.label || source,
        output: this.state[source]?.output ?? this.state[fromId]?.output ?? '',
      },
    };
    [...reset].filter((id) => id !== fromId).forEach((id) => {
      this.setNode(id, { status: 'pending', output: undefined, verdict: undefined, activity: null, loop: count });
    });
    this.emit({ type: 'loop', edge: key, count, max: edge.loop });
    return reset.has(fromId);
  }
}
