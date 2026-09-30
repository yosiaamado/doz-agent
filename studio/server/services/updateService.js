// Update sekali klik: unduh + verifikasi manifest bertanda tangan, lalu ganti file plugin dan aset web secara transaksional.
// Jalur ini menulis file di mesin user, jadi semua yang datang dari manifest diperlakukan sebagai input tak tepercaya.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ApiError, conflict } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { updateManifest, MAX_UPDATE_TOTAL_BYTES } from '../http/schemas.js';
import { PUBLIC_KEYS, verifyManifestSignature } from '../infra/updateKeys.js';
import { compareVersions, isAllowedUrl, resolveEndpoint, validateEndpoint } from '../infra/updateConfig.js';

const MANIFEST_TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;
const CACHE_TTL_MS = 15 * 60 * 1000;
const HISTORY_LIMIT = 10;
const BACKUP_GENERATIONS = 3;
const MAX_DETAILS = 20;

const err = (status, message, code, params, details) => new ApiError(status, message, { code, params, details });
const unreachable = (params) => err(503, 'Cannot reach the update server', 'UPDATE_UNREACHABLE', params);
const invalidManifest = (details) => err(422, 'Update manifest is not valid', 'UPDATE_MANIFEST_INVALID', undefined, details);
const tooLarge = () => err(422, 'Update payload is too large', 'UPDATE_MANIFEST_TOO_LARGE');
const pathRejected = (p) => err(422, 'Update manifest contains an unsafe file path', 'UPDATE_PATH_REJECTED', { path: String(p).slice(0, 200) });
const mismatch = (p) => err(422, 'Downloaded file does not match its checksum', 'UPDATE_CHECKSUM_MISMATCH', { path: p });
const applyFailed = (p) => err(500, 'Update failed and was rolled back', 'UPDATE_APPLY_FAILED', { path: p });

const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const isInside = (root, abs) => abs.startsWith(root + path.sep);

// Isi manifest ditulis dengan path yang diawali `plugins/` untuk target plugins; folder tujuan sudah pluginDir.
const relativeInTarget = (entry) => (entry.target === 'plugins' ? entry.path.slice('plugins/'.length) : entry.path);
const entryKey = (entry) => `${entry.target}/${entry.path}`;

function lstatOrNull(p) {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
}

// Menolak kalau ada komponen path (folder atau file akhir) berupa symlink, supaya penulisan tidak keluar folder tujuan.
// allowHardlink (jalur baca: check) melaporkan hardlink lewat return value; jalur tulis tetap menolak keras.
function assertNoSymlinks(root, abs, displayed, { allowHardlink = false } = {}) {
  let current = root;
  for (const segment of path.relative(root, abs).split(path.sep)) {
    current = path.join(current, segment);
    const stat = lstatOrNull(current);
    if (!stat) return;
    if (stat.isSymbolicLink()) throw pathRejected(displayed);
  }
  const final = lstatOrNull(abs);
  if (!final?.isFile()) throw pathRejected(displayed);
  // File yang kita kelola tidak pernah punya hardlink; nlink > 1 berarti inode-nya dibagi dengan path lain (mis. di luar folder ini).
  if (final.nlink > 1) {
    if (!allowHardlink) throw pathRejected(displayed);
    return { hardlinked: true };
  }
  return { hardlinked: false };
}

// Setelah folder induk dibuat: pastikan lokasi nyata (symlink/junction terselesaikan) masih di dalam root.
// Celah waktu antara cek dan tulis tidak bisa ditutup total tanpa openat/O_NOFOLLOW, jadi cek diulang tepat sebelum
// tiap tulis/hapus/backup dan lokasi nyata diverifikasi; penyerang harus sudah punya izin tulis di folder plugin.
function assertRealInside(root, abs, displayed) {
  let realRoot;
  try {
    realRoot = fs.realpathSync(root);
  } catch {
    return;
  }
  const realParent = fs.realpathSync(path.dirname(abs));
  if (realParent !== realRoot && !isInside(realRoot, realParent)) throw pathRejected(displayed);
}

function resolveInside(root, relative, displayed) {
  const abs = path.resolve(root, relative);
  if (!isInside(root, abs)) throw pathRejected(displayed);
  return abs;
}

async function fetchWithRedirects(startUrl, { env, timeoutMs, headers }) {
  let url = startUrl;
  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let res;
    try {
      res = await fetch(url, { headers, redirect: 'manual', signal });
    } catch {
      throw unreachable();
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      await res.body?.cancel().catch(() => {});
      let next;
      try {
        next = location ? new URL(location, url) : null;
      } catch {
        next = null;
      }
      // Setiap redirect harus tetap HTTPS; downgrade ke http ditolak.
      if (!next || !isAllowedUrl(next, env)) throw unreachable({ status: res.status });
      url = next.toString();
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw unreachable({ status: res.status });
    }
    return res;
  }
  throw unreachable();
}

async function readLimited(res, limit) {
  const declared = Number(res.headers.get('content-length'));
  if (declared > limit) throw tooLarge();
  const chunks = [];
  let total = 0;
  try {
    for await (const chunk of res.body) {
      total += chunk.length;
      if (total > limit) throw tooLarge();
      chunks.push(chunk);
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw unreachable();
  }
  return Buffer.concat(chunks).toString('utf8');
}

function valueAt(root, pathParts) {
  return pathParts.reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), root);
}

// Urutan: JSON → schema → signature (pada objek mentah) → bentuk (zod) → host URL. Tidak ada file yang diunduh sebelum semuanya lolos.
function parseManifest(text, { env, keys }) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw invalidManifest(['body: not JSON']);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalidManifest(['body: not an object']);
  if (raw.schema !== 1) {
    const shown = typeof raw.schema === 'number' || typeof raw.schema === 'string' ? raw.schema : 'unknown';
    throw err(422, 'Unsupported manifest schema', 'UPDATE_SCHEMA_UNSUPPORTED', { schema: typeof shown === 'string' ? shown.slice(0, 20) : shown });
  }
  if (!verifyManifestSignature(raw, keys)) throw err(422, 'Update manifest signature is not valid', 'UPDATE_SIGNATURE_INVALID');
  const parsed = updateManifest.safeParse(raw);
  if (!parsed.success) {
    const unsafe = parsed.error.issues.find((i) => i.message === 'UNSAFE_PATH');
    if (unsafe) throw pathRejected(valueAt(raw, unsafe.path) ?? '');
    throw invalidManifest(parsed.error.issues.slice(0, MAX_DETAILS).map((i) => `${i.path.join('.') || 'body'}: ${i.message}`));
  }
  const manifest = parsed.data;
  const base = new URL(manifest.baseUrl);
  if (!isAllowedUrl(base, env)) throw invalidManifest(['baseUrl: must use https']);
  const files = manifest.files.map((file, i) => {
    let resolved;
    try {
      resolved = new URL(file.url, base);
    } catch {
      throw invalidManifest([`files.${i}.url: Invalid`]);
    }
    if (resolved.host !== base.host || !isAllowedUrl(resolved, env)) throw invalidManifest([`files.${i}.url: must stay on the baseUrl host`]);
    return { ...file, resolvedUrl: resolved.toString() };
  });
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_UPDATE_TOTAL_BYTES) throw tooLarge();
  return { ...manifest, files };
}

// restoreFile bisa diganti di test untuk mensimulasikan rollback yang gagal.
export function createUpdateService({ config, isRunActive = () => false, env = process.env, now = Date.now, keys = PUBLIC_KEYS, restoreFile = fs.copyFileSync }) {
  const userData = path.resolve(config.userDataDir);
  const installedFile = path.join(userData, 'installed.json');
  const stagingRoot = path.join(userData, 'staging');
  const backupsRoot = path.join(userData, 'backups');
  const targetRoot = (target) => (target === 'plugins' ? path.resolve(config.pluginDir) : path.join(userData, 'web', 'dist'));

  let cache = null; // { at, endpoint, manifest, data } — hanya di memori
  let applying = false;

  const readJson = (file) => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  };

  const readInstalled = () => {
    const data = readJson(installedFile);
    return data && typeof data === 'object' && data.files && typeof data.files === 'object' ? data : null;
  };
  const seedInfo = () => readJson(path.join(config.pluginDir, '.doz-seed.json'));
  // Content version (plugins + web), BUKAN versi binary. Fallback ke appVersion hanya untuk mode dev tanpa installed.json/seed.
  // Berkas lama (sebelum rename) memakai kunci `version`; dibaca sebagai fallback, selalu ditulis dengan `contentVersion`.
  const versionOf = (data) => (typeof data?.contentVersion === 'string' ? data.contentVersion : typeof data?.version === 'string' ? data.version : undefined);
  const contentVersion = () => versionOf(readInstalled()) ?? versionOf(seedInfo()) ?? config.appVersion;

  // server/** ada di dalam app.asar dan tidak bisa di-update; konten yang butuh binary lebih baru harus ditolak sebelum mengunduh apa pun.
  function assertAppCompatible(manifest) {
    if (compareVersions(config.appVersion, manifest.minAppVersion) < 0) {
      throw err(422, `This update needs app version ${manifest.minAppVersion} or newer (installed: ${config.appVersion}). Download and install the latest installer, then check for updates again.`, 'UPDATE_REQUIRES_NEW_APP', { minAppVersion: manifest.minAppVersion, appVersion: config.appVersion });
    }
  }
  const savedUpdate = () => config.readSaved().update ?? {};
  const saveUpdate = (patch) => {
    try {
      config.mergeSaved({ update: { ...savedUpdate(), ...patch } });
    } catch (e) {
      // Gagal menyimpan status tidak boleh membuat update/cek gagal (AC-10).
      logger.warn('could not save update status', { error: e?.message });
    }
  };
  const currentEndpoint = () => resolveEndpoint(config.readSaved());
  // Hasil cek dari endpoint ad-hoc (override sekali pakai) tidak boleh dipakai apply() yang berjalan atas endpoint tersimpan.
  const normalizedEndpoint = () => {
    try {
      return validateEndpoint(currentEndpoint().endpoint, env);
    } catch {
      return null;
    }
  };
  const freshCache = () => (cache && now() - cache.at < CACHE_TTL_MS && cache.endpoint === normalizedEndpoint() ? cache : null);

  // Hash yang tercatat untuk file ini. Tanpa installed.json, file hasil seeding yang belum disentuh
  // (mtime <= waktu seeding) dianggap masih asli; selain itu dianggap edit lokal (konservatif).
  function recordedHash(key, dest, diskHash) {
    const installed = readInstalled();
    if (installed) return installed.files[key];
    const seededAt = seedInfo()?.seededAt;
    if (typeof seededAt === 'number' && fs.statSync(dest).mtimeMs <= seededAt) return diskHash;
    return undefined;
  }

  // Instalasi pertama dari seed: catat file bawaan yang belum disentuh user supaya update berikutnya tidak menganggapnya edit lokal.
  function seededFiles() {
    const seededAt = seedInfo()?.seededAt;
    const out = {};
    if (typeof seededAt !== 'number') return out;
    const root = path.resolve(config.pluginDir);
    const walk = (dir) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(full);
        else if (ent.isFile() && ent.name !== '.doz-seed.json' && fs.statSync(full).mtimeMs <= seededAt) {
          out[entryKey({ target: 'plugins', path: `plugins/${path.relative(root, full).split(path.sep).join('/')}` })] = sha256File(full);
        }
      }
    };
    try { walk(root); } catch { /* folder belum ada */ }
    return out;
  }

  // state: new | same | clean | edited
  function classify(file) {
    const root = targetRoot(file.target);
    const dest = resolveInside(root, relativeInTarget(file), file.path);
    const link = assertNoSymlinks(root, dest, file.path, { allowHardlink: true });
    if (!lstatOrNull(dest)) return { file, dest, state: 'new' };
    // Hardlink (mis. hasil restore tool backup/dedup): terbaca sebagai 'edited' supaya check tetap jalan; menulisnya baru ditolak keras.
    if (link?.hardlinked) return { file, dest, state: 'edited', hardlinked: true };
    const diskHash = sha256File(dest);
    if (diskHash === file.sha256) return { file, dest, state: 'same' };
    return { file, dest, state: recordedHash(entryKey(file), dest, diskHash) === diskHash ? 'clean' : 'edited' };
  }

  async function loadManifest(endpoint) {
    const res = await fetchWithRedirects(endpoint, {
      env,
      timeoutMs: MANIFEST_TIMEOUT_MS,
      headers: { accept: 'application/json', 'user-agent': `doz-studio/${config.appVersion}`, 'cache-control': 'no-cache' },
    });
    return parseManifest(await readLimited(res, MAX_MANIFEST_BYTES), { env, keys });
  }

  function summarize(manifest, checkedAt) {
    const currentContentVersion = contentVersion();
    const localEdits = manifest.files.map(classify).filter((c) => c.state === 'edited').map(({ file }) => ({ path: file.path, target: file.target }));
    return {
      updateAvailable: compareVersions(manifest.contentVersion, currentContentVersion) > 0,
      currentContentVersion,
      contentVersion: manifest.contentVersion,
      minAppVersion: manifest.minAppVersion,
      releasedAt: manifest.releasedAt,
      notes: manifest.notes,
      fileCount: manifest.files.length,
      totalBytes: manifest.files.reduce((sum, f) => sum + f.size, 0),
      localEdits,
      checkedAt,
    };
  }

  async function downloadFile(file, stagingDir) {
    const dest = resolveInside(stagingDir, path.join(file.target, file.path), file.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const res = await fetchWithRedirects(file.resolvedUrl, { env, timeoutMs: DOWNLOAD_TIMEOUT_MS, headers: { 'user-agent': `doz-studio/${config.appVersion}` } });
    if (Number(res.headers.get('content-length')) > file.size) throw mismatch(file.path);
    const hash = crypto.createHash('sha256');
    let total = 0;
    const fd = fs.openSync(dest, 'wx');
    try {
      for await (const chunk of res.body) {
        total += chunk.length;
        if (total > file.size) throw mismatch(file.path);
        hash.update(chunk);
        fs.writeSync(fd, chunk);
      }
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw e?.syscall ? applyFailed(file.path) : unreachable();
    } finally {
      fs.closeSync(fd);
    }
    if (total !== file.size || hash.digest('hex') !== file.sha256) throw mismatch(file.path);
    return dest;
  }

  function moveFile(src, dest, root, displayed) {
    assertNoSymlinks(root, dest, displayed);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    assertRealInside(root, dest, displayed);
    try {
      fs.renameSync(src, dest);
    } catch (e) {
      if (e.code !== 'EXDEV') throw e;
      // Lepas entri lama dulu: copy langsung ke dest akan menulis menembus hardlink/symlink yang muncul belakangan.
      fs.rmSync(dest, { force: true });
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
    }
  }

  function backupFile(backupDir, entry, dest) {
    assertNoSymlinks(targetRoot(entry.target), dest, entry.path);
    // Struktur backup mengikuti struktur asli di folder tujuan (tanpa awalan plugins/ yang hanya ada di manifest).
    const target = resolveInside(path.join(backupDir, entry.target), relativeInTarget(entry), entry.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(dest, target);
    return target;
  }

  // Mengembalikan semua file yang sudah disentuh. Mengembalikan daftar kegagalan; pemanggil wajib melaporkannya,
  // karena rollback parsial meninggalkan campuran versi lama dan baru (backup tetap ada untuk pemulihan manual).
  function rollback(done) {
    const failures = [];
    for (const step of [...done].reverse()) {
      try {
        // Tidak ada yang perlu dipulihkan: file baru yang belum sempat ditulis.
        if (!step.backup && !lstatOrNull(step.dest)) continue;
        assertNoSymlinks(step.root, step.dest, step.path);
        if (step.backup) {
          fs.mkdirSync(path.dirname(step.dest), { recursive: true });
          assertRealInside(step.root, step.dest, step.path);
          restoreFile(step.backup, step.dest);
        } else {
          fs.rmSync(step.dest, { force: true });
        }
      } catch (e) {
        failures.push(step.path);
        logger.error('update rollback failed for one file', { dest: step.dest, error: e?.message });
      }
    }
    return failures;
  }

  function writeInstalled(contentVersion, files) {
    fs.mkdirSync(userData, { recursive: true });
    const tmp = `${installedFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ contentVersion, appliedAt: now(), files }, null, 2));
    fs.renameSync(tmp, installedFile);
  }

  function pruneBackups() {
    try {
      const dirs = fs.readdirSync(backupsRoot).filter((d) => /^\d+$/.test(d)).sort((a, b) => Number(b) - Number(a));
      for (const dir of dirs.slice(BACKUP_GENERATIONS)) fs.rmSync(path.join(backupsRoot, dir), { recursive: true, force: true });
    } catch {
      // belum ada backup
    }
  }

  return {
    contentVersion,
    status() {
      const { endpoint, endpointIsDefault } = currentEndpoint();
      const saved = savedUpdate();
      const live = freshCache();
      return {
        appVersion: config.appVersion,
        contentVersion: contentVersion(),
        endpoint,
        endpointIsDefault,
        lastCheckedAt: saved.lastCheckedAt ?? null,
        lastResult: saved.lastResult ?? 'never',
        available: live?.data.updateAvailable ? live.data : null,
        applying,
        // Entri lama (sebelum rename) menyimpan `version`; dinormalkan supaya UI hanya melihat satu nama.
        history: Array.isArray(saved.history) ? saved.history.map(({ version, ...h }) => ({ ...h, contentVersion: h.contentVersion ?? version })) : [],
      };
    },

    getSettings: () => {
      const { endpoint, endpointIsDefault } = currentEndpoint();
      return { endpoint, endpointIsDefault };
    },

    setSettings({ endpoint }) {
      const value = endpoint === null ? null : validateEndpoint(endpoint, env);
      saveUpdate({ endpoint: value });
      cache = null;
      return this.getSettings();
    },

    async check({ endpoint } = {}) {
      const target = validateEndpoint(endpoint || currentEndpoint().endpoint, env); // endpoint tersimpan pun diperiksa ulang
      const checkedAt = now();
      try {
        const manifest = await loadManifest(target);
        assertAppCompatible(manifest);
        const data = summarize(manifest, checkedAt);
        cache = { at: checkedAt, endpoint: target, manifest, data };
        saveUpdate({ lastCheckedAt: checkedAt, lastResult: data.updateAvailable ? 'available' : 'up-to-date' });
        return data;
      } catch (e) {
        saveUpdate({ lastCheckedAt: checkedAt, lastResult: 'error' });
        throw e;
      }
    },

    async apply({ contentVersion: requested, overwriteLocalEdits = false }) {
      if (isRunActive()) throw conflict('Stop running workflows before updating', { code: 'UPDATE_BUSY_RUN' });
      if (applying) throw conflict('An update is already in progress', { code: 'UPDATE_ALREADY_RUNNING' });
      applying = true;
      const startedAt = now();
      const stale = () => conflict('Update information is stale, check again', { code: 'UPDATE_STALE_MANIFEST' });
      let stagingDir = null;
      try {
        const live = freshCache();
        // Versi yang sama atau lebih lama ditolak juga: mencegah downgrade lewat manifest lama yang masih bertanda tangan valid.
        if (!live || live.manifest.contentVersion !== requested || compareVersions(requested, contentVersion()) <= 0) throw stale();
        const { manifest } = live;
        assertAppCompatible(manifest); // sebelum apa pun diunduh

        const plan = manifest.files.map(classify);
        const skipped = [];
        const toWrite = [];
        for (const item of plan) {
          if (item.state === 'edited' && !overwriteLocalEdits) skipped.push({ path: item.file.path, target: item.file.target, reason: 'local-edit' });
          else if (item.state !== 'same') toWrite.push(item);
        }
        for (const item of toWrite) if (item.hardlinked) throw pathRejected(item.file.path);
        const installedBefore = readInstalled();
        const toRemove = [];
        for (const entry of manifest.removed ?? []) {
          const root = targetRoot(entry.target);
          const dest = resolveInside(root, relativeInTarget(entry), entry.path);
          if (!lstatOrNull(dest)) continue;
          assertNoSymlinks(root, dest, entry.path);
          const recorded = installedBefore?.files[entryKey(entry)];
          // File yang bukan milik studio (tidak tercatat) tidak disentuh; yang sudah diedit di-skip.
          if (!recorded) continue;
          if (sha256File(dest) !== recorded) skipped.push({ path: entry.path, target: entry.target, reason: 'local-edit' });
          else toRemove.push({ entry, dest });
        }

        // Semua unduhan harus lolos checksum sebelum satu pun file target disentuh.
        stagingDir = path.join(stagingRoot, manifest.contentVersion);
        fs.rmSync(stagingDir, { recursive: true, force: true });
        fs.mkdirSync(stagingDir, { recursive: true });
        const staged = new Map();
        for (const item of toWrite) staged.set(item, await downloadFile(item.file, stagingDir));

        let backupId = startedAt;
        while (fs.existsSync(path.join(backupsRoot, String(backupId)))) backupId += 1;
        const backupDir = path.join(backupsRoot, String(backupId));
        const backedUp = [];
        const backupOf = new Map();
        const needsBackup = [...toWrite.filter((i) => i.state !== 'new').map((i) => ({ entry: i.file, dest: i.dest })), ...toRemove];
        for (const { entry, dest } of needsBackup) {
          try {
            backupOf.set(dest, backupFile(backupDir, entry, dest));
          } catch (e) {
            throw e instanceof ApiError ? e : applyFailed(entry.path);
          }
          backedUp.push({ target: entry.target, path: entry.path });
        }
        if (backedUp.length) fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify({ contentVersion: manifest.contentVersion, createdAt: startedAt, files: backedUp }, null, 2));

        const done = [];
        let touched = 0;
        let current = '';
        const files = installedBefore ? { ...installedBefore.files } : seededFiles();
        try {
          for (const item of toWrite) {
            current = item.file.path;
            // Dicatat sebelum dipindah: kalau pemindahan gagal di tengah, rollback tetap mencoba memulihkan file ini.
            done.push({ dest: item.dest, root: targetRoot(item.file.target), path: item.file.path, backup: backupOf.get(item.dest) ?? null });
            moveFile(staged.get(item), item.dest, targetRoot(item.file.target), item.file.path);
            touched += 1;
          }
          for (const { entry, dest } of toRemove) {
            current = entry.path;
            assertNoSymlinks(targetRoot(entry.target), dest, entry.path);
            done.push({ dest, root: targetRoot(entry.target), path: entry.path, backup: backupOf.get(dest) });
            fs.unlinkSync(dest);
            delete files[entryKey(entry)];
          }
          for (const { file } of plan) {
            if (!skipped.some((sk) => sk.path === file.path && sk.target === file.target)) files[entryKey(file)] = file.sha256;
          }
          current = 'installed.json';
          writeInstalled(manifest.contentVersion, files);
        } catch (e) {
          const failures = rollback(done);
          logger.error('update failed', { path: current, error: e?.message, backupDir, rollbackFailures: failures.length });
          if (failures.length) {
            throw err(500, 'Update failed and could not be fully rolled back; restore the files from the backup folder', 'UPDATE_ROLLBACK_INCOMPLETE', { path: current, failed: failures.length, backupDir });
          }
          throw e instanceof ApiError ? e : applyFailed(current);
        }

        const appliedAt = now();
        const history = [{ contentVersion: manifest.contentVersion, appliedAt, files: touched, skipped: skipped.length }, ...(Array.isArray(savedUpdate().history) ? savedUpdate().history : [])].slice(0, HISTORY_LIMIT);
        saveUpdate({ history, lastResult: 'up-to-date', lastCheckedAt: appliedAt });
        cache = null;
        const changedWeb = toWrite.some((i) => i.file.target === 'web') || toRemove.some((r) => r.entry.target === 'web');
        return {
          contentVersion: manifest.contentVersion,
          applied: touched,
          skipped,
          removed: toRemove.length,
          backupDir: backedUp.length ? backupDir : null,
          reloadWeb: changedWeb,
          durationMs: now() - startedAt,
        };
      } finally {
        if (stagingDir) fs.rmSync(stagingDir, { recursive: true, force: true });
        pruneBackups();
        applying = false;
      }
    },
  };
}
