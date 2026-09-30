// User config storage in the OS app-data folder (config.json, usage.json) plus a one-time migration from studio/.local.json.
import path from 'node:path';
import fs from 'node:fs';

const FILE_MODE = 0o600;

// POSIX only: mode 0o600 = only the owner may read/write.
// On Windows the `mode` argument and chmod do not set ACLs (the file still inherits the user profile folder's permissions),
// so secrets are protected there by encryption (see apiKeyStore.js), not by the file mode.
// writeFileSync({ mode }) only applies when the file is created; an explicit chmod tightens pre-existing files too.
export function tightenPermissions(file) {
  if (process.platform === 'win32') return;
  try {
    fs.chmodSync(file, FILE_MODE);
  } catch {
    // the file does not exist yet, or is not ours; not fatal
  }
}

export function createConfigStore(file) {
  tightenPermissions(file);
  return {
    file,
    read() {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        return {};
      }
    },
    merge(patch) {
      const next = { ...this.read(), ...patch };
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(next, null, 2), { mode: FILE_MODE });
      tightenPermissions(file);
      return next;
    },
  };
}

const LEGACY_FILES = Object.freeze([
  { from: '.local.json', to: 'config.json' },
  { from: '.usage.json', to: 'usage.json' },
]);

// Idempotent: never overwrites the new file and never throws. The old file is not deleted (dev users still rely on it),
// but its secret fields are stripped once the new copy is proven written, so no plain-text key is left behind in studio/.local.json.
const SECRET_FIELDS = Object.freeze(['anthropicApiKey', 'anthropicApiKeyEnc']);

export function scrubSecrets(file, logger) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!SECRET_FIELDS.some((k) => k in data)) return false;
    for (const k of SECRET_FIELDS) delete data[k];
    fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: FILE_MODE });
    tightenPermissions(file);
    return true;
  } catch (err) {
    // The source is read-only or not JSON: do not fail the migration, but do not stay quiet about the secret left behind either.
    logger?.warn('could not remove secrets from the legacy config file; delete them manually', { file, error: err?.message });
    return false;
  }
}
export function migrateLegacyFiles({ studioDir, userDataDir, logger }) {
  const migrated = [];
  for (const { from, to } of LEGACY_FILES) {
    const src = path.join(studioDir, from);
    const dst = path.join(userDataDir, to);
    if (fs.existsSync(dst) || !fs.existsSync(src)) continue;
    try {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.writeFileSync(dst, fs.readFileSync(src), { mode: FILE_MODE });
      tightenPermissions(dst);
      if (fs.readFileSync(dst).length === 0 && fs.statSync(src).size > 0) throw new Error('empty copy');
      scrubSecrets(src, logger);
      migrated.push(to);
    } catch (err) {
      logger?.warn('config migration failed', { from: src, error: err?.message });
      continue;
    }
    try {
      fs.writeFileSync(`${src}.migrated`, JSON.stringify({ migratedAt: Date.now(), to: dst }));
    } catch {
      // studioDir is read-only (packaged): the marker is informational only, and the migration still counts because dst already exists.
    }
  }
  if (migrated.length) logger?.info('legacy config moved to app data', { files: migrated, userDataDir });
  return migrated;
}
