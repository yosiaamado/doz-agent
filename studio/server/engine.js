// Eksekutor graph workflow. Tidak tahu soal HTTP; semua kejadian dikirim lewat `emit(event)`.
//
// Aturan:
// - Node siap jalan kalau semua edge masuk (non-loop) sudah selesai/di-skip dan minimal satu edge aktif.
//   Semua edge masuk tidak aktif → node di-skip (cabang yang tidak dipilih condition).
// - condition/approval memilih edge `when: true` atau `when: false`.
// - Edge dengan `loop: N` mengulang node tujuan + semua node di bawahnya, maksimal N kali.
import { resolveSettings } from './workflow.js';
import { buildNodePrompt, buildJudgePrompt, parseVerdict } from './prompt.js';
import { runCommand } from './runners/shell.js';

// Node yang menghasilkan output kerja (diteruskan ke node berikutnya dan dilacak perubahan file-nya).
const WORK = new Set(['agent', 'skill', 'action']);

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
    this.state = {};
    for (const n of wf.nodes) this.state[n.id] = { status: 'pending', attempts: 0 };
    this.active = new Set(); // index edge yang aktif
    this.loopCount = {};
    this.feedback = {};
    this.running = new Map();
    this.approvals = new Map();
    this.cost = 0;
    this.stopped = false;
    this.status = 'pending';
  }

  incoming(id) {
    return this.wf.edges.map((e, i) => ({ ...e, i })).filter((e) => e.to === id && !e.loop);
  }

  outgoing(id) {
    return this.wf.edges.map((e, i) => ({ ...e, i })).filter((e) => e.from === id);
  }

  setNode(id, patch) {
    Object.assign(this.state[id], patch);
    this.emit({ type: 'node', node: id, ...patch });
  }

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
    this.emit({ type: 'run_end', status: this.status, cost: this.cost, error: this.error });
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

  readyNodes() {
    const ready = [];
    for (const n of this.wf.nodes) {
      if (this.state[n.id].status !== 'pending') continue;
      const inc = this.incoming(n.id);
      if (inc.some((e) => !['done', 'skipped'].includes(this.state[e.from].status))) continue;
      const triggered = inc.length === 0 || inc.some((e) => this.active.has(e.i));
      ready.push({ node: n, skip: !triggered });
    }
    return ready;
  }

  async loop() {
    const limit = Math.max(1, Number(this.wf.parallel) || 3);
    while (!this.stopped) {
      for (const { node, skip } of this.readyNodes()) {
        if (skip) {
          this.setNode(node.id, { status: 'skipped' });
          continue;
        }
        if (this.running.size >= limit) break;
        const abort = new AbortController();
        const promise = this.execute(node, abort.signal)
          .catch((err) => this.onNodeError(node, err))
          .finally(() => this.running.delete(node.id));
        this.running.set(node.id, { promise, abort });
      }
      // Skip bisa membuka node lain; ulangi sebelum menunggu.
      if (this.readyNodes().some((r) => r.skip)) continue;
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

  activateOutgoing(id, when = undefined) {
    for (const e of this.outgoing(id)) {
      if (when !== undefined && e.when !== undefined && e.when !== when) continue;
      if (e.loop) this.triggerLoop(e, id);
      else this.active.add(e.i);
    }
  }

  // Mengulang node tujuan loop beserta semua turunannya.
  triggerLoop(edge, fromId) {
    const key = `${edge.from}->${edge.to}`;
    const count = (this.loopCount[key] ?? 0) + 1;
    if (count > edge.loop) {
      throw new Error(`Batas loop ${key} (${edge.loop}x) habis dan masih belum lolos`);
    }
    this.loopCount[key] = count;
    const reset = new Set();
    const stack = [edge.to];
    while (stack.length) {
      const id = stack.pop();
      if (reset.has(id)) continue;
      reset.add(id);
      for (const e of this.outgoing(id)) if (!e.loop) stack.push(e.to);
    }
    this.wf.edges.forEach((e, i) => { if (reset.has(e.from)) this.active.delete(i); });
    const source = this.nodes[fromId].source ?? this.incoming(fromId)[0]?.from;
    this.feedback[edge.to] = {
      attempt: count + 1,
      from: this.nodes[source]?.label || source,
      output: this.state[source]?.output ?? this.state[fromId]?.output ?? '',
    };
    for (const id of reset) {
      if (id === fromId) continue; // condition sendiri selesai dulu, di-reset di bawah
      this.setNode(id, { status: 'pending', output: undefined, verdict: undefined, activity: null, loop: count });
    }
    this.emit({ type: 'loop', edge: key, count, max: edge.loop });
    if (reset.has(fromId)) this.pendingReset = fromId;
  }

  upstreamOutputs(node, mode) {
    if (mode === 'none') return [];
    let ids;
    if (Array.isArray(mode)) ids = mode;
    else if (mode === 'all') ids = this.ancestors(node.id);
    else ids = this.incoming(node.id).map((e) => e.from);
    return ids
      .map((id) => this.nodes[id])
      .filter((n) => n && WORK.has(n.type) && this.state[n.id].status === 'done' && this.state[n.id].output)
      .map((n) => ({ node: n, output: this.state[n.id].output }));
  }

  ancestors(id) {
    const seen = new Set();
    const stack = [id];
    while (stack.length) {
      for (const e of this.incoming(stack.pop())) {
        if (!seen.has(e.from)) { seen.add(e.from); stack.push(e.from); }
      }
    }
    return [...seen];
  }

  infoFor(id) {
    return this.incoming(id)
      .map((e) => this.nodes[e.from])
      .filter((n) => n.type === 'info' && n.text)
      .map((n) => n.text);
  }

  async execute(node, signal) {
    const started = Date.now();
    this.setNode(node.id, {
      status: 'running', startedAt: started, endedAt: undefined, error: undefined, warning: undefined,
      usage: undefined, cost: undefined, changes: undefined, diff: undefined, touched: undefined,
    });
    const tracked = WORK.has(node.type) && this.tracker;
    const base = tracked ? await this.tracker.snapshot(this.workdir).catch(() => null) : null;
    this.touched = this.touched ?? {};
    this.touched[node.id] = new Set();
    let result;
    switch (node.type) {
      case 'start':
      case 'info':
        result = { output: node.type === 'start' ? (this.input || node.input || '') : node.text ?? '' };
        break;
      case 'output':
        result = { output: this.upstreamOutputs(node, 'all').map((u) => `## ${u.node.label || u.node.id}\n\n${u.output}`).join('\n\n---\n\n') };
        break;
      case 'condition':
        result = await this.evaluateCondition(node, signal);
        break;
      case 'approval':
        result = await this.waitApproval(node);
        break;
      case 'action':
        result = await this.runAction(node, signal);
        break;
      default:
        result = await this.runAgent(node, signal);
    }
    if (this.stopped && this.status === 'stopped') {
      this.setNode(node.id, { status: 'stopped', activity: null });
      return;
    }
    let changes;
    let diff;
    if (base) {
      const head = await this.tracker.snapshot(this.workdir).catch(() => null);
      if (head) {
        diff = { base, head };
        changes = await this.tracker.changes(this.workdir, base, head).catch(() => undefined);
      }
    }
    const touched = [...(this.touched[node.id] ?? [])];
    this.setNode(node.id, {
      status: 'done',
      changes,
      diff,
      touched: touched.length ? touched : undefined,
      endedAt: Date.now(),
      output: result.output,
      verdict: result.verdict,
      reason: result.reason,
      cost: result.cost,
      usage: result.usage,
      turns: result.turns,
      warning: result.warning,
      exitCode: result.exitCode,
      activity: null,
      durationMs: Date.now() - started,
    });
    const branching = node.type === 'condition' || node.type === 'approval';
    this.pendingReset = null;
    this.activateOutgoing(node.id, branching ? result.verdict : undefined);
    if (this.pendingReset) this.setNode(this.pendingReset, { status: 'pending' });
  }

  async runAgent(node, signal) {
    const agent = node.type === 'agent' ? this.agents[node.agent] : null;
    if (node.type === 'agent' && !agent) throw new Error(`Agent "${node.agent}" tidak ditemukan`);
    const settings = resolveSettings(node, this.wf, agent);
    const runner = this.runners[settings.runner];
    if (!runner) throw new Error(`Runner "${settings.runner}" tidak dikenal`);
    const prompt = buildNodePrompt({
      wf: this.wf,
      node,
      settings,
      input: this.input,
      upstream: this.upstreamOutputs(node, settings.inputs),
      infos: this.infoFor(node.id),
      feedback: this.feedback[node.id] ?? null,
    });
    const attempts = Math.max(0, Number(settings.retry) || 0) + 1;
    let lastErr;
    const opts = { node, agent, settings, prompt, workdir: this.workdir };
    const command = runner.describe?.(opts);
    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (signal.aborted) break;
      this.setNode(node.id, { attempts: attempt, settings, prompt, command });
      try {
        const res = await withTimeout(settings.timeout_min, signal, (attemptSignal) => runner.run({
          ...opts, signal: attemptSignal,
          onActivity: (activity) => {
            if (activity.file) this.touched[node.id]?.add(activity.file);
            this.emit({ type: 'activity', node: node.id, ...activity });
          },
          onUsage: (usage) => this.emit({ type: 'node', node: node.id, usage }),
        }));
        this.cost += res.cost ?? 0;
        this.emit({ type: 'cost', total: this.cost });
        if (this.wf.budget_usd && this.cost > this.wf.budget_usd) {
          this.fail(`Budget workflow $${this.wf.budget_usd} terlampaui ($${this.cost.toFixed(2)})`);
        }
        return { ...res, verdict: node.verdict ? parseVerdict(res.output) : undefined };
      } catch (err) {
        lastErr = err;
        if (signal.aborted) break;
        if (attempt < attempts) this.emit({ type: 'activity', node: node.id, kind: 'retry', text: `Gagal, coba lagi (${err.message})` });
      }
    }
    throw lastErr ?? new Error('dihentikan');
  }

  async runAction(node, signal) {
    const preset = node.action ? this.actions[node.action] : null;
    if (node.action && !preset) throw new Error(`Action "${node.action}" tidak ditemukan`);
    const command = node.command || preset?.command;
    if (!command) throw new Error('Action tanpa perintah');
    const timeout = Number(node.timeout_min ?? preset?.timeout_min) || 15;
    this.setNode(node.id, { command, prompt: undefined });
    this.emit({ type: 'activity', node: node.id, kind: 'tool', tool: 'Shell', text: `$ ${command}` });
    const res = await withTimeout(timeout, signal, (s) => runCommand({
      command, workdir: this.workdir, signal: s,
      onLine: (line) => this.emit({ type: 'activity', node: node.id, kind: 'text', text: line }),
    }));
    return { output: `$ ${command}\n(exit ${res.code})\n\n${res.output}`, verdict: res.code === 0, exitCode: res.code };
  }

  async evaluateCondition(node, signal) {
    const sourceId = node.source ?? this.incoming(node.id)[0]?.from;
    const subject = this.state[sourceId]?.output ?? '';
    const mode = node.mode ?? 'auto';
    const known = this.state[sourceId]?.verdict;
    if (mode !== 'llm' && typeof known === 'boolean') {
      return { verdict: known, output: `Hasil ${sourceId}: ${known ? 'PASS' : 'FAIL'}`, reason: 'verdict' };
    }
    if (mode !== 'llm') {
      const v = parseVerdict(subject);
      if (v !== null) return { verdict: v, output: `VERDICT dari ${sourceId}: ${v ? 'PASS' : 'FAIL'}`, reason: 'verdict' };
      if (mode === 'verdict') throw new Error(`Output ${sourceId} tidak punya baris VERDICT`);
    }
    const settings = resolveSettings({ ...node, model: node.model ?? 'haiku', max_turns: 1 }, this.wf, null);
    const runner = this.runners[settings.runner];
    this.emit({ type: 'activity', node: node.id, kind: 'text', text: `Menilai: ${node.check}` });
    const judgePrompt = buildJudgePrompt({ question: node.check, subject });
    const res = await withTimeout(settings.timeout_min, signal, (s) => runner.judge({ prompt: judgePrompt, settings, workdir: this.workdir, signal: s }));
    this.cost += res.cost ?? 0;
    const v = parseVerdict(res.output);
    if (v === null) throw new Error('Penilai tidak mengembalikan VERDICT');
    return { verdict: v, output: res.output, cost: res.cost, reason: 'llm' };
  }

  waitApproval(node) {
    this.setNode(node.id, { status: 'waiting', activity: node.message || 'Menunggu persetujuan' });
    return new Promise((resolve) => {
      this.approvals.set(node.id, ({ approved, note }) => {
        this.approvals.delete(node.id);
        resolve({ verdict: approved, output: `${approved ? 'Disetujui' : 'Ditolak'}${note ? `: ${note}` : ''}` });
      });
    });
  }

  snapshot() {
    return { id: this.id, workflow: this.wf.name, status: this.status, cost: this.cost, error: this.error, state: this.state, input: this.input };
  }
}

// Menjalankan fn dengan signal sendiri yang ikut batal saat node dihentikan atau waktu habis.
function withTimeout(minutes, signal, fn) {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal.addEventListener('abort', onAbort);
  let timer;
  const timeout = new Promise((_, reject) => {
    if (!minutes) return;
    timer = setTimeout(() => {
      ctrl.abort();
      reject(new Error(`timeout ${minutes} menit`));
    }, minutes * 60_000);
  });
  return Promise.race([fn(ctrl.signal), timeout]).finally(() => {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  });
}
