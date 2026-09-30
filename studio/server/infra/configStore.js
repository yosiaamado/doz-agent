// Penyimpanan config user di app-data OS (config.json, usage.json) + migrasi sekali jalan dari studio/.local.json.
import path from 'node:path';
import fs from 'node:fs';

const FILE_MODE = 0o600;

// Hanya berlaku di POSIX: mode 0o600 = pemilik saja yang boleh baca/tulis.
// Di Windows argumen `mode` dan chmod tidak mengatur ACL (file tetap mewarisi izin folder profil user),
// jadi perlindungan rahasia di sana datang dari enkripsi (lihat apiKeyStore.js), bukan dari file mode.
// writeFileSync({ mode }) hanya berlaku saat file dibuat; chmod eksplisit memperketat file lama juga.
export function tightenPermissions(file) {
  if (process.platform === 'win32') return;
  try {
    fs.chmodSync(file, FILE_MODE);
  } catch {
    // file belum ada atau bukan milik kita; tidak fatal
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

// Idempoten: tidak menimpa file baru dan tidak pernah melempar. File lama tidak dihapus (user dev masih memakainya),
// tetapi field rahasianya dibuang setelah salinan baru terbukti tertulis, supaya key plain text tidak tertinggal di studio/.local.json.
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
    // Sumber read-only atau bukan JSON: jangan gagalkan migrasi, tapi jangan diam soal rahasia yang tertinggal.
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
      if (fs.readFileSync(dst).length === 0 && fs.statSync(src).size > 0) throw new Error('salinan kosong');
      scrubSecrets(src, logger);
      migrated.push(to);
    } catch (err) {
      logger?.warn('config migration failed', { from: src, error: err?.message });
      continue;
    }
    try {
      fs.writeFileSync(`${src}.migrated`, JSON.stringify({ migratedAt: Date.now(), to: dst }));
    } catch {
      // studioDir read-only (paket): penanda hanya informasi, migrasi tetap sah karena dst sudah ada.
    }
  }
  if (migrated.length) logger?.info('legacy config moved to app data', { files: migrated, userDataDir });
  return migrated;
}
