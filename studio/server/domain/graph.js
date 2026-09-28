// Fungsi murni untuk membaca struktur graph workflow. Edge diberi index `i` supaya bisa dilacak.

export const WORK_TYPES = Object.freeze(new Set(['agent', 'skill', 'action']));
export const BRANCHING_TYPES = Object.freeze(new Set(['condition', 'approval']));

export function indexedEdges(wf) {
  return wf.edges.map((e, i) => ({ ...e, i }));
}

export function incoming(wf, id) {
  return indexedEdges(wf).filter((e) => e.to === id && !e.loop);
}

export function outgoing(wf, id) {
  return indexedEdges(wf).filter((e) => e.from === id);
}

export function ancestors(wf, id) {
  const seen = new Set();
  const stack = [id];
  while (stack.length) {
    for (const e of incoming(wf, stack.pop())) {
      if (!seen.has(e.from)) {
        seen.add(e.from);
        stack.push(e.from);
      }
    }
  }
  return [...seen];
}

// Node ini dan semua turunannya lewat edge non-loop (yang diulang saat loop dipicu).
export function downstream(wf, id) {
  const seen = new Set();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    outgoing(wf, current).filter((e) => !e.loop).forEach((e) => stack.push(e.to));
  }
  return seen;
}

const SETTLED = new Set(['done', 'skipped']);

// Node pending yang semua sumbernya sudah selesai. `skip` = tidak ada edge masuk yang aktif.
export function readyNodes(wf, state, activeEdges) {
  return wf.nodes
    .filter((n) => state[n.id].status === 'pending')
    .map((n) => ({ node: n, inc: incoming(wf, n.id) }))
    .filter(({ inc }) => inc.every((e) => SETTLED.has(state[e.from].status)))
    .map(({ node, inc }) => ({ node, skip: inc.length > 0 && !inc.some((e) => activeEdges.has(e.i)) }));
}

// Edge keluar yang dipilih setelah node selesai. Untuk condition/approval hanya cabang `when` yang cocok.
export function chosenEdges(wf, id, verdict) {
  return outgoing(wf, id).filter((e) => verdict === undefined || e.when === undefined || e.when === verdict);
}
