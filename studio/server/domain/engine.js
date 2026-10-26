// Workflow run orchestrator. Knows nothing about HTTP; every event goes out through `emit(event)`.
//
// Rules:
// - A node is ready to run once every incoming (non-loop) edge is done/skipped and at least one edge is active.
//   Every incoming edge inactive → the node is skipped (the branch the condition did not pick).
// - condition/approval picks the `when: true` or `when: false` edge.
// - An edge with `loop: N` replays the target node plus every node below it, at most N times.
import { BRANCHING_TYPES, WORK_TYPES, ancestors, chosenEdges, downstream, incoming, outgoing, readyNodes } from './graph.js';
import { EXECUTORS } from './executors.js';
import { CodedError, codeOf } from '../lib/errors.js';

const RESET_FIELDS = {
  endedAt: undefined, error: undefined, warning: undefined,
  // The code uses null (not undefined): JSON drops undefined, which would mean the UI never clears the previous code.
  errorCode: null, errorParams: null, warningCode: null, activityCode: null, usage: undefined, cost: undefined,
  changes: undefined, diff: undefined, touched: undefined,
};

export class WorkflowRun {
  // tracker: { snapshot(workdir), changes(workdir, base, head) } used to compute the files each node changed.
  constructor({ id, wf, agents, actions = [], input, workdir, runners, emit, tracker = null, spawn = null }) {
    this.id = id;
    this.wf = wf;
    this.agents = Object.fromEntries(agents.map((a) => [a.name, a]));
    this.actions = Object.fromEntries(actions.map((a) => [a.name, a]));
    this.tracker = tracker;
    // SpawnContext (child-process environments, may hold a key): kept off every emitted event.
    this.spawn = spawn;
    this.input = input;
    this.workdir = workdir;
    this.runners = runners;
    this.emit = (e) => emit({ ts: Date.now(), run: id, ...e });
    this.nodes = Object.fromEntries(wf.nodes.map((n) => [n.id, n]));
    this.state = Object.fromEntries(wf.nodes.map((n) => [n.id, { status: 'pending', attempts: 0 }]));
    this.active = new Set(); // indexes of the active edges
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

  // ---- state (always replaced with a new object, never mutated) ----

  setNode(id, rawPatch) {
    // activityCode is cleared along with the activity, so stale code does not stick around in the UI.
    const patch = 'activity' in rawPatch && !('activityCode' in rawPatch) ? { ...rawPatch, activityCode: null } : rawPatch;
    this.state = { ...this.state, [id]: { ...this.state[id], ...patch } };
    this.emit({ type: 'node', node: id, ...patch });
  }

  addCost(amount = 0) {
    this.cost += amount ?? 0;
    this.emit({ type: 'cost', total: this.cost });
    if (this.wf.budget_usd && this.cost > this.wf.budget_usd) {
      this.fail(`Workflow budget $${this.wf.budget_usd} exceeded ($${this.cost.toFixed(2)})`, 'BUDGET_EXCEEDED', { budget: this.wf.budget_usd, cost: Number(this.cost.toFixed(2)) });
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

  // ---- queries for the executors ----

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

  // ---- the run lifecycle ----

  async start() {
    this.status = 'running';
    if (!this.input) this.input = this.wf.nodes.find((n) => n.type === 'start' && n.input)?.input ?? '';
    this.emit({ type: 'run_start', workflow: this.wf.name, input: this.input, workdir: this.workdir });
    try {
      await this.loop();
    } catch (err) {
      this.fail(err.message, codeOf(err).code, codeOf(err).params);
    }
    if (this.status === 'running') {
      const failed = Object.values(this.state).some((s) => s.status === 'failed');
      this.status = this.stopped ? 'stopped' : failed ? 'failed' : 'done';
    }
    this.emit({ type: 'run_end', status: this.status, cost: this.cost, error: this.error ?? undefined, errorCode: this.errorCode, errorParams: this.errorParams });
    return this.status;
  }

  fail(message, code, params) {
    this.status = 'failed';
    this.error = message;
    this.errorCode = code;
    this.errorParams = params;
    this.stopped = true;
  }

  stop() {
    this.stopped = true;
    this.status = 'stopped';
    for (const { abort } of this.running.values()) abort.abort();
    for (const resolve of this.approvals.values()) resolve({ approved: false, note: 'run stopped' });
  }

  approve(nodeId, approved, note = '') {
    const resolve = this.approvals.get(nodeId);
    if (!resolve) throw new CodedError(`Node ${nodeId} is not waiting for approval`, 'NODE_NOT_WAITING', { node: nodeId });
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
      // A skip can unblock other nodes; loop again before waiting if anything else is runnable.
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
    this.setNode(node.id, { status: 'failed', error: err.message, errorCode: codeOf(err).code ?? null, errorParams: codeOf(err).params ?? null, activity: null });
    this.fail(`${node.label || node.id} failed: ${err.message}`, 'NODE_FAILED', { node: node.label || node.id, reason: err.message });
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
    const next = [...new Map(outgoing(this.wf, node.id).filter((e) => this.nodes[e.to])
      .map((e) => [e.to, { id: e.to, label: this.nodes[e.to].label || e.to }])).values()];
    this.setNode(node.id, { ...RESET_FIELDS, status: 'running', startedAt, agent: node.agent ?? null, label: node.label || node.id, next });
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
      warningCode: result.warningCode,
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

  // Replays the loop target node and all of its descendants. Returns true if the source node was reset too.
  triggerLoop(edge, fromId) {
    const key = `${edge.from}->${edge.to}`;
    const count = (this.loopCount[key] ?? 0) + 1;
    if (count > edge.loop) throw new CodedError(`Loop limit ${key} (${edge.loop}x) reached and still not passing`, 'LOOP_LIMIT_REACHED', { edge: key, max: edge.loop });
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
