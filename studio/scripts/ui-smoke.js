// Render smoke test: mounts the React app in jsdom and fails (exit 1) if rendering throws or the ErrorBoundary shows up.
// Usage: `node scripts/ui-smoke.js [en|id]`. Called by test/ui-smoke.test.js (one process per language so the DOM stays clean).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locale = process.argv[2] === 'id' ? 'id' : 'en';

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', { url: 'http://localhost:4317/', pretendToBeVisual: true });
const { window } = dom;
const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'SVGElement', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage', 'DOMParser', 'Event', 'KeyboardEvent', 'MouseEvent', 'FileReader']) {
  define(name, name === 'window' ? window : window[name]);
}
define('navigator', window.navigator);
define('location', window.location);
define('IS_REACT_ACT_ENVIRONMENT', false);
define('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
define('DOMMatrixReadOnly', class { constructor() { this.m22 = 1; } });
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.ResizeObserver = globalThis.ResizeObserver;
window.DOMMatrixReadOnly = globalThis.DOMMatrixReadOnly;
window.localStorage.setItem('doz-studio:locale', locale);
window.localStorage.setItem('doz-studio:last-workflow', 'demo');

// Mock data shaped exactly like the server responses.
const agent = { name: 'qa-tester', path: '/p/qa-tester.md', file: 'plugins/agents/qa-tester.md', description: 'Tests things', tools: ['Read', 'Grep'], model: 'sonnet', effort: 'high', maxTurns: 20, color: 'blue', shadowed: false };
const workflow = {
  name: 'demo', description: 'Demo workflow', defaults: { runner: 'claude-cli' }, parallel: 3, budget_usd: null, notes: '',
  nodes: [{ id: 'start', type: 'start', label: 'Request' }, { id: 'qa', type: 'agent', agent: 'qa-tester' }, { id: 'check', type: 'condition', check: 'ok?' }, { id: 'out', type: 'output' }],
  edges: [{ from: 'start', to: 'qa' }, { from: 'qa', to: 'check' }, { from: 'check', to: 'out', when: true }],
  layout: { start: [0, 0], qa: [280, 0], check: [560, 0], out: [840, 0] },
};
const source = (entry) => ({ entry, path: `/p/${entry}`, exists: true });
const routes = {
  '/api/status': { workdir: '/w', workdirName: 'w', appVersion: '2.0.0', contentVersion: '2.0.0', git: true, runners: { 'claude-cli': { available: true, detail: '2.1.0' }, api: { available: false, detail: 'set ANTHROPIC_API_KEY', code: 'API_KEY_NOT_SET' } } },
  '/api/setup': { state: { completedAt: 1 }, node: { status: 'ok', detail: 'Node 24' }, git: { status: 'ok', detail: 'git' } },
  '/api/library/agents': [agent],
  '/api/library/skills': [{ name: 'doz-agent:ship-feature', path: '/p/s', file: 'f', description: 'Ship it', shadowed: false }],
  '/api/library/actions': [{ name: 'test', path: '/p/a', file: 'f', description: 'Run tests', command: 'npm test', shadowed: false }],
  '/api/sources': { agents: [source('plugins/agents')], skills: [source('plugins/skills')], actions: [source('plugins/actions')], workflows: [source('plugins/workflows')] },
  '/api/workflows': [{ name: 'demo', description: 'Demo workflow', nodes: 4 }],
  '/api/workflows/demo': { workflow, errors: [] },
  '/api/runs': [{ id: 'r1', workflow: 'demo', status: 'done', started: Date.now(), duration: 65000, cost: 0.02, source: 'studio' }],
  '/api/usage': {},
  '/api/git/repo': { isRepo: true, files: [] },
  '/api/library/agents/qa-tester': { name: 'qa-tester', file: 'plugins/agents/qa-tester.md', meta: { description: 'Tests things', model: 'sonnet', tools: 'Read, Grep' }, body: 'You are QA.', text: 'You are QA.', strict: true, usedBy: ['demo'] },
  '/api/folders': { path: '/w', name: 'w', display: '/w', segments: ['w'], parent: null, markers: ['git'], folders: [{ name: 'src', path: '/w/src' }], roots: [{ id: 'home', label: 'Home', path: '/h' }, { id: 'workdir', label: 'Active project', path: '/w' }, { id: 'drive', label: 'C:', path: 'C:/' }] },
  '/api/git/workdir': { isRepo: true, files: [{ path: 'a.md', status: 'modified' }], branch: 'main', upstream: 'origin/main', ahead: 2, behind: 0, remote: 'git@x', lastCommit: 'abc' },
  '/api/update/settings': { endpoint: 'https://example.com/doz-update.json', endpointIsDefault: true },
  '/api/update/status': { appVersion: '2.0.0', contentVersion: '2.0.0', lastResult: 'never', available: null, applying: false, history: [] },
};
define('fetch', async (url) => {
  const key = String(url).split('?')[0];
  if (!Object.hasOwn(routes, key)) return { json: async () => ({ success: false, error: `no mock for ${key}`, code: 'NOT_FOUND' }) };
  return { json: async () => ({ success: true, data: routes[key] }) };
});
define('WebSocket', class { close() {} });

const errors = [];
const originalError = console.error;
console.error = (...args) => { errors.push(args.map(String).join(' ')); };
window.addEventListener('error', (e) => errors.push(`window error: ${e.message}`));

const server = await createServer({ root: path.join(STUDIO, 'web'), appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] } });
let failure = null;
try {
  await server.ssrLoadModule('/src/main.jsx');
  const deadline = Date.now() + 8000;
  const has = (sel) => document.querySelector(sel);
  while (Date.now() < deadline && !(has('.topbar') && has('.fnode'))) await new Promise((r) => setTimeout(r, 50));
  // Click every main control so the lazy dialogs/panels get rendered too (bug class: shadowed variables, hooks in the wrong order).
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const escape = () => document.activeElement?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  let modalsSeen = 0;
  for (const selector of ['.topbar button', '.rail-item', '.seg button', '.lfooter', '.litem-edit', '.lgroup-head .icon-btn', '.rpanel-head .icon-btn']) {
    for (const el of [...document.querySelectorAll(selector)]) {
      if (has('[role="alert"].loading')) break;
      el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await pause(120);
      if (has('.modal')) modalsSeen++;
      escape();
      await pause(30);
    }
  }
  const boundary = has('[role="alert"].loading');
  if (boundary) failure = `the ErrorBoundary showed up: ${boundary.textContent}`;
  else if (!has('.topbar')) failure = `UI did not render (root: ${document.getElementById('root').innerHTML.slice(0, 200)})`;
  else if (modalsSeen < 3) failure = `only ${modalsSeen} dialog(s) opened during the click sweep (expected >= 3)`;
  else if (!has('.fnode')) failure = 'the canvas rendered no nodes';
  else if (document.documentElement.lang !== locale) failure = `lang=${document.documentElement.lang}, expected ${locale}`;
  const fatal = errors.filter((e) => /TypeError|ReferenceError|is not a function|Uncaught|The above error/.test(e));
  if (!failure && fatal.length) failure = `error di console: ${fatal[0].slice(0, 300)}`;
} catch (err) {
  failure = `import/render failed: ${err.stack ?? err}`;
} finally {
  await server.close();
}
console.error = originalError;
if (failure) {
  console.error(`ui-smoke [${locale}] FAILED: ${failure}`);
  for (const e of errors.slice(0, 3)) console.error(e.slice(0, 900));
  process.exit(1);
}
console.log(`ui-smoke [${locale}] OK`);
process.exit(0);
