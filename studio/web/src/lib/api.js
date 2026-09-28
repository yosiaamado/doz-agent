// Klien API. Server selalu membalas { success, data } atau { success: false, error, details }.
export class ApiRequestError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.details = details ?? [];
  }
}

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiRequestError('Server studio tidak bisa dihubungi. Pastikan `npm start` masih jalan.');
  }
  const json = await res.json().catch(() => ({ success: false, error: res.statusText }));
  if (!json.success) throw new ApiRequestError(json.error ?? 'Permintaan gagal', json.details);
  return json.data;
}

const enc = encodeURIComponent;

export const api = {
  status: () => request('GET', '/api/status'),
  setWorkdir: (path) => request('POST', '/api/workdir', { path }),
  folders: (path) => request('GET', `/api/folders${path ? `?path=${enc(path)}` : ''}`),
  sources: () => request('GET', '/api/sources'),
  saveSources: (sources) => request('PUT', '/api/sources', sources),
  usage: () => request('GET', '/api/usage'),
  refreshUsage: () => request('POST', '/api/usage/refresh'),
  library: (kind) => request('GET', `/api/library/${kind}`),
  item: (kind, name) => request('GET', `/api/library/${kind}/${enc(name)}`),
  createItem: (kind, body) => request('POST', `/api/library/${kind}`, body),
  updateItem: (kind, name, body) => request('PUT', `/api/library/${kind}/${enc(name)}`, body),
  workflows: () => request('GET', '/api/workflows'),
  workflow: (name) => request('GET', `/api/workflows/${enc(name)}`),
  saveWorkflow: (name, workflow) => request('PUT', `/api/workflows/${enc(name)}`, { workflow }),
  runs: () => request('GET', '/api/runs'),
  run: (id) => request('GET', `/api/runs/${enc(id)}`),
  startRun: (body) => request('POST', '/api/runs', body),
  stopRun: (id) => request('POST', `/api/runs/${enc(id)}/stop`),
  approve: (id, node, approved, note) => request('POST', `/api/runs/${enc(id)}/approve`, { node, approved, note }),
  uploadAttachment: (name, contentBase64) => request('POST', '/api/attachments', { name, contentBase64 }),
  gitStatus: (target) => request('GET', `/api/git/${target}`),
  gitAction: (target, action, body) => request('POST', `/api/git/${target}/${action}`, body ?? {}),
  setup: () => request('GET', '/api/setup'),
  setupTest: (name, target) => request('POST', `/api/setup/test/${name}${target ? `?target=${target}` : ''}`),
  setApiKey: (key, remember) => request('PUT', '/api/setup/api-key', { key, remember }),
  clearApiKey: () => request('DELETE', '/api/setup/api-key'),
  setGitIdentity: (name, email) => request('PUT', '/api/setup/git-identity', { name, email }),
  claudeLogin: (useConsole) => request('POST', '/api/setup/claude-login', { console: useConsole }),
  completeSetup: () => request('POST', '/api/setup/complete'),
  diff: (base, head, file) => request('GET', `/api/diff?${new URLSearchParams({ base, head, ...(file ? { file } : {}) })}`),
};

// WebSocket dengan reconnect otomatis.
export function connectEvents(onMessage) {
  let ws;
  let closed = false;
  const open = () => {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onmessage = (m) => {
      try { onMessage(JSON.parse(m.data)); } catch { /* pesan rusak diabaikan */ }
    };
    ws.onclose = () => { if (!closed) setTimeout(open, 1500); };
  };
  open();
  return () => { closed = true; ws?.close(); };
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error(`Gagal membaca ${file.name}`));
    reader.readAsDataURL(file);
  });
}
