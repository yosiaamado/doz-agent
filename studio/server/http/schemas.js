// API input validation schemas (zod). Every body and query is validated before it reaches a service.
import { z } from 'zod';

const shortText = z.string().max(500);
const sha = z.string().regex(/^[0-9a-f]{40,64}$/, 'invalid snapshot');

export const workdirBody = z.object({ path: z.string().min(1).max(4096) });

export const sourcesBody = z.object({
  agents: z.array(shortText).optional(),
  skills: z.array(shortText).optional(),
  actions: z.array(shortText).optional(),
  workflows: z.array(shortText).optional(),
});

export const componentKind = z.enum(['agents', 'skills', 'actions']);

export const createComponentBody = z.object({
  name: z.string().min(1).max(64),
  dir: z.string().max(4096).optional(),
  area: z.string().max(64).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  body: z.string().max(500_000).optional(),
});

export const updateComponentBody = z.union([
  z.object({ text: z.string().min(1).max(500_000) }),
  z.object({ meta: z.record(z.string(), z.unknown()).optional(), body: z.string().max(500_000).optional() }),
]);

const workflowObject = z.object({ nodes: z.array(z.record(z.string(), z.unknown())), edges: z.array(z.unknown()) }).passthrough();

export const saveWorkflowBody = z.object({ workflow: workflowObject });

export const startRunBody = z.object({
  workflow: workflowObject.optional(),
  name: z.string().max(64).optional(),
  input: z.string().max(200_000).default(''),
  attachments: z.array(z.string().regex(/^[a-f0-9]{16}$/)).max(20).default([]),
}).refine((b) => b.workflow || b.name, 'provide workflow or name');

export const approveBody = z.object({ node: z.string().min(1), approved: z.boolean(), note: z.string().max(5000).default('') });

export const attachmentBody = z.object({ name: z.string().min(1).max(255), contentBase64: z.string().min(1) });

export const diffQuery = z.object({ base: sha, head: sha, file: z.string().max(4096).optional() });

export const folderQuery = z.object({ path: z.string().max(4096).optional() });

export const gitTarget = z.enum(['repo', 'workdir']);

export const commitBody = z.object({
  message: z.string().trim().min(1, 'a commit message is required').max(2000),
  files: z.array(z.string().min(1).max(4096)).max(500).optional(),
});

export const setupTest = z.enum(['claude-cli', 'api', 'github']);

export const apiKeyBody = z.object({
  key: z.string().trim().min(20, 'API key is too short').max(300).regex(/^sk-ant-/, 'Anthropic API keys start with sk-ant-'),
  remember: z.boolean().default(false),
});

export const gitIdentityBody = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email('invalid email').max(320),
});

export const claudeLoginBody = z.object({ console: z.boolean().default(false) });

// slot S5 (filled): the update schemas live in the "One-click update" block below

// --- One-click update (S5) ---
export const UPDATE_TARGETS = Object.freeze(['plugins', 'web']);
export const MAX_UPDATE_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_UPDATE_TOTAL_BYTES = 80 * 1024 * 1024;
export const MAX_UPDATE_FILES = 2000;
const MAX_NOTES_CHARS = 20_000;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

// Windows device names (CON, NUL, COM1, ...) with or without an extension; rejected on every OS so manifests stay portable.
// On Windows, creating a file named NUL through Node produces an entry that is hard to delete from Explorer.
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])$/i;

// A relative POSIX path that is safe to write under the destination folder. This check is only the first layer;
// updateService re-checks the path.resolve result plus symlinks at write time.
export function isSafeRelativePath(p) {
  if (typeof p !== 'string' || !p || p.length > 500) return false;
  if (p.includes('\\') || p.includes('\0') || p.includes(':') || p.startsWith('/')) return false;
  return p.split('/').every((seg) => seg && seg !== '.' && seg !== '..' && !/[. ]$/.test(seg) && !WINDOWS_DEVICE.test(seg.split('.')[0]));
}

const semver = z.string().max(64).regex(SEMVER, 'version must be semver x.y.z');
const updatePath = z.string().max(500).refine(isSafeRelativePath, 'UNSAFE_PATH');
const updateTarget = z.enum(UPDATE_TARGETS);
// The `plugins` target uses paths prefixed with `plugins/` (relative to the repo root); that prefix is stripped when writing into pluginDir.
const targetPrefixOk = (e) => e.target !== 'plugins' || e.path.startsWith('plugins/');

const manifestFile = z.object({
  path: updatePath,
  target: updateTarget,
  url: z.string().min(1).max(2048),
  size: z.number().int().positive().max(MAX_UPDATE_FILE_BYTES),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, 'sha256 must be 64 lowercase hex characters'),
}).refine(targetPrefixOk, { message: 'UNSAFE_PATH', path: ['path'] });

const manifestRemoved = z.object({ path: updatePath, target: updateTarget }).refine(targetPrefixOk, { message: 'UNSAFE_PATH', path: ['path'] });

const entryKey = (e) => `${e.target}/${e.path.toLowerCase()}`;

export const updateManifest = z.object({
  schema: z.literal(1),
  contentVersion: semver,
  releasedAt: z.string().max(64),
  // Required: a manifest without this field is rejected (never silently treated as compatible with every binary).
  minAppVersion: semver,
  notes: z.object({ en: z.string().max(MAX_NOTES_CHARS), id: z.string().max(MAX_NOTES_CHARS).optional() }),
  baseUrl: z.string().max(2048).url().refine((u) => u.startsWith('https:') || u.startsWith('http:'), 'baseUrl must use https').refine((u) => u.endsWith('/'), 'baseUrl must end with /'),
  files: z.array(manifestFile).min(1).max(MAX_UPDATE_FILES),
  removed: z.array(manifestRemoved).max(MAX_UPDATE_FILES).optional(),
  signature: z.object({ alg: z.literal('ed25519'), keyId: z.string().min(1).max(64), value: z.string().min(1).max(200) }),
}).superRefine((m, ctx) => {
  const seen = new Set();
  for (const [i, f] of m.files.entries()) {
    if (seen.has(entryKey(f))) ctx.addIssue({ code: 'custom', message: 'duplicate path', path: ['files', i, 'path'] });
    seen.add(entryKey(f));
  }
  for (const [i, r] of (m.removed ?? []).entries()) {
    if (seen.has(entryKey(r))) ctx.addIssue({ code: 'custom', message: 'path is in both files and removed', path: ['removed', i, 'path'] });
  }
});

export const updateCheckBody = z.object({ endpoint: z.string().max(2048).optional() });
export const updateApplyBody = z.object({ contentVersion: semver, overwriteLocalEdits: z.boolean().default(false) });
export const updateSettingsBody = z.object({ endpoint: z.string().trim().min(1).max(2048).nullable() });
