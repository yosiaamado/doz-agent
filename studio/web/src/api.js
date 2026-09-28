async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error ?? res.statusText);
    err.errors = data.errors;
    throw err;
  }
  return data;
}

export const api = {
  status: () => request('GET', '/api/status'),
  setWorkdir: (path) => request('POST', '/api/workdir', { path }),
  sources: () => request('GET', '/api/sources'),
  saveSources: (sources) => request('PUT', '/api/sources', sources),
  library: (kind) => request('GET', `/api/library/${kind}`),
  item: (kind, name) => request('GET', `/api/library/${kind}/${encodeURIComponent(name)}`),
  createItem: (kind, body) => request('POST', `/api/library/${kind}`, body),
  updateItem: (kind, name, body) => request('PUT', `/api/library/${kind}/${encodeURIComponent(name)}`, body),
  diff: (base, head, file) => request('GET', `/api/diff?${new URLSearchParams({ base, head, ...(file ? { file } : {}) })}`),
  workflows: () => request('GET', '/api/workflows'),
  workflow: (name) => request('GET', `/api/workflows/${encodeURIComponent(name)}`),
  saveWorkflow: (name, workflow) => request('PUT', `/api/workflows/${encodeURIComponent(name)}`, { workflow }),
  deleteWorkflow: (name) => request('DELETE', `/api/workflows/${encodeURIComponent(name)}`),
  runs: () => request('GET', '/api/runs'),
  run: (id) => request('GET', `/api/runs/${encodeURIComponent(id)}`),
  startRun: (workflow, input) => request('POST', '/api/runs', { workflow, input }),
  stopRun: (id) => request('POST', `/api/runs/${encodeURIComponent(id)}/stop`),
  approve: (id, node, approved, note) => request('POST', `/api/runs/${encodeURIComponent(id)}/approve`, { node, approved, note }),
};

// WebSocket dengan reconnect otomatis.
export function connectEvents(onMessage) {
  let ws;
  let closed = false;
  const open = () => {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onmessage = (m) => {
      try { onMessage(JSON.parse(m.data)); } catch { /* abaikan pesan rusak */ }
    };
    ws.onclose = () => { if (!closed) setTimeout(open, 1500); };
  };
  open();
  return () => { closed = true; ws?.close(); };
}
