# doz studio — Desktop App Dua Bahasa (ID/EN) + Update Sekali Klik

Status: spec siap dikerjakan. Satu-satunya sumber acuan untuk backend-engineer, frontend-engineer, dan devops-engineer.
Aturan: **jangan edit file spec ini**. Backend tidak perlu membaca `studio/web/**`; frontend tidak perlu membaca `studio/server/**`.

---

## Konteks repo

| Hal | Nilai |
| --- | --- |
| Root project | `E:\Business\doz-agent` (berisi `plugins/`, `studio/`, `tests/`, `docs/`) |
| App | `studio/` — `package.json` name `doz-studio`, `"type": "module"`, Node >= 20 |
| Backend | Node 20 ESM **tanpa framework**. Entry `studio/server/index.js` → `createApp()` di `studio/server/app.js` (composition root) |
| HTTP | Router manual `studio/server/http/router.js`, validasi zod `studio/server/http/schemas.js`, respons `studio/server/http/respond.js`, static `studio/server/http/static.js`, WS `studio/server/http/socket.js` (path `/ws`) |
| Frontend | React 19 + Vite 8, `studio/web/` (root Vite = `web`, output `web/dist`). `@xyflow/react`, `lucide-react` |
| Perintah | `cd studio` → `npm run dev` (server --watch + vite di 5317, proxy `/api` & `/ws` ke 4317) · `npm run build` (`vite build web`) · `npm start` (`node server/index.js`) · `npm test` (`node --test`) |
| Runner | `studio/server/runners/claude-cli.js` (spawn `claude -p`, pakai `--plugin-dir <pluginDir>` di baris 52) dan `studio/server/runners/api.js` (@anthropic-ai/sdk) |
| Lint | tidak ada linter. Ikuti gaya file sekitar: ESM, named export, factory `createXxx()`, komentar 1 baris bahasa Indonesia di atas file |

### Konvensi yang WAJIB diikuti (jangan bikin pola baru)

1. **Envelope respons** — sukses `{ "success": true, "data": <apa pun> }`; gagal `{ "success": false, "error": "<pesan>", "details": [...] }`. Lihat `studio/server/http/respond.js`. Project **tidak** pakai RFC 9457 — jangan diubah di spec ini.
2. **Error** — lempar `ApiError` lewat helper di `studio/server/lib/errors.js` (`badRequest` 400, `forbidden` 403, `notFound` 404, `conflict` 409). Error tak terduga otomatis jadi 500 dengan pesan generik.
3. **Penamaan field JSON** — camelCase (`workdirName`, `contentBase64`, `updatedAt`).
4. **Route** — didaftarkan per-file di `studio/server/routes/*.js` dengan fungsi `registerXxxRoutes(router, deps)`, prefix `/api/`. Handler hanya memanggil service dan mengembalikan objek data; envelope dan error di-handle `app.js`.
5. **Validasi** — semua body/query lewat skema zod yang diekspor dari `studio/server/http/schemas.js`, dipanggil `schema.parse(body)` di route.
6. **Auth** — tidak ada login. `assertLocalRequest` (`studio/server/http/middleware.js`) menolak request non-loopback. Semua endpoint baru otomatis ikut aturan itu. "Auth" di kontrak di bawah = "loopback saja".
7. **FE memanggil API** — hanya lewat `studio/web/src/lib/api.js` (satu method per endpoint, pakai helper `request`). Error jadi `ApiRequestError` dengan `.message` dan `.details`. Jangan `fetch` langsung di komponen.
8. **Preferensi UI persist** — `readStorage`/`writeStorage` di `studio/web/src/lib/storage.js` dengan key ber-prefix `doz-studio:` (contoh `useTheme.js`).
9. **Komponen UI** — ada di `studio/web/src/components/ui/` (`Field`, `Select`, `Toast` → `useToast`, `Dialogs` → `useDialog`, `Modal`). Pakai yang ada.

---

## Requirement

**User story** — Sebagai developer internasional yang beli doz studio $20 di Gumroad, saya mau memasang installer Windows, memakai studio dalam bahasa Inggris (atau Indonesia), dan menerima pembaruan plugin sekali klik — tanpa meng-clone repo, tanpa memasang Node, dan tanpa menjalankan `npm build`.

**Acceptance criteria**

| ID | Kriteria |
| --- | --- |
| AC-1 | Studio jalan dari app terpaket (folder resource read-only), dari zip yang diekstrak, dan dari dalam repo dev — tanpa perubahan konfigurasi manual. |
| AC-2 | Config user (workdir, API key, setup, sources) dan data pemakaian tersimpan di folder app-data OS, bukan di dalam folder install. Config lama di `studio/.local.json` ikut terbawa satu kali. |
| AC-3 | Kalau tidak ada repo induk doz-agent, studio tetap jalan: sumber komponen yang tidak ada di-skip, fitur "Repo doz-agent" tidak meledak. |
| AC-4 | Port 4317 terpakai → server pindah ke port bebas dan UI tetap tersambung (termasuk WebSocket). |
| AC-5 | Seluruh UI studio tersedia dalam EN dan ID. Bahasa dipilih di langkah pertama SetupWizard dan bisa diubah di Settings; pilihan bertahan setelah restart. |
| AC-6 | Tidak ada string UI yang tertinggal tanpa terjemahan — diverifikasi oleh script, bukan mata. |
| AC-7 | Tombol "Check for updates" menampilkan versi baru + catatan rilis, lalu satu klik "Update" mengganti file `plugins/` dan aset web. Binary app tidak ikut diganti. |
| AC-8 | Update menolak: endpoint non-HTTPS, manifest tanpa signature valid, checksum file tidak cocok, dan path file yang keluar dari folder tujuan. |
| AC-9 | File plugin yang sudah diedit pembeli tidak hilang diam-diam. |
| AC-10 | Offline atau endpoint balas 404/500 → studio tetap jalan normal, hanya menampilkan pesan "tidak bisa memeriksa pembaruan". |
| AC-11 | `.exe` Windows bisa dibangun dari CI tanpa code signing; struktur build tidak menghalangi target `.dmg` macOS menyusul. |

**Keputusan final (jangan tawarkan alternatif):** Electron (bukan Tauri), server Node tetap jalan di dalam app · v1 Windows `.exe` saja · tanpa code signing · tanpa lisensi/aktivasi · tanpa telemetry · file instruksi (`plugins/agents/*.md`, `plugins/skills/**/SKILL.md` + references) **hanya bahasa Inggris**, tidak ada versi Indonesia yang dipelihara · update mengganti file plugin + aset web, bukan binary · endpoint update default = GitHub Releases (raw JSON manifest), bisa diganti user di Settings.

---

## Slice

Satu slice = satu panggilan engineer.

| Slice | Nama | AC | Layer | Pemilik |
| --- | --- | --- | --- | --- |
| **S1** | Resolusi path 3 mode + config app-data + fallback port | AC-1, AC-2, AC-3, AC-4 | Backend | `be-1` |
| **S2** | i18n ID/EN di seluruh UI + kode error dari server | AC-5, AC-6 | Frontend (+ sedikit Backend di `be-1`, sudah termasuk S1) | `fe-1` |
| **S5** | Update sekali klik (manifest, verifikasi, terapkan) | AC-7, AC-8, AC-9, AC-10 | Backend + Frontend | `be-2` (BE), `fe-2` (FE) |
| **S3** | Bundling Electron + CI build `.exe` | AC-11 | DevOps | `devops-1` |

Urutan: **S1 ∥ S2 ∥ S5-BE ∥ S5-FE jalan paralel** (lihat "Rencana eksekusi" di laporan). **S3 mulai setelah S1 `done`**, karena S3 bergantung pada `runtimePaths` dan `startServer()` yang dibuat S1.

Batas kepemilikan file yang perlu diperhatikan:
- `studio/server/app.js` dan `studio/server/http/schemas.js` disentuh S1 **dan** S5-BE. Untuk menghindari dua pemilik: **S1 memiliki `app.js` dan `schemas.js`** dan sudah menyiapkan slot kosong untuk S5 (lihat Peta file). S5-BE hanya menambah di dalam slot yang sudah ada.
- `studio/web/src/lib/api.js` dimiliki **S2 (`fe-1`)**. S5-FE menambah method update ke file itu **setelah** S2 `done` — karena itu S5-FE dijadwalkan setelah S2 (lihat catatan urutan di laporan).

---

## S1 — Path, config, dan port

### Tiga mode runtime

| Mode | Ciri | `pluginDir` | `webDist` | `repoRoot` |
| --- | --- | --- | --- | --- |
| **dev** (di dalam repo) | ada folder `<studioDir>/../plugins` **dan** `<studioDir>/../.git` | `<studioDir>/../plugins` | `<studioDir>/web/dist` | `<studioDir>/..` |
| **zip diekstrak** | ada `<studioDir>/../plugins` tanpa `.git`, atau ada `<studioDir>/plugins` | folder `plugins` pertama yang ditemukan (lihat urutan di bawah) | `<studioDir>/web/dist` | folder induk kalau ada `plugins` di sana, kalau tidak `null` |
| **electron packaged** | `process.env.DOZ_RESOURCES_DIR` di-set oleh main process | `<userDataDir>/plugins` (writable, lihat "seeding") | `<resourcesDir>/web/dist` (read-only) | `null` |

**Urutan resolusi `pluginDir`** (pakai yang pertama berisi folder `agents/` atau `skills/`):
1. `process.env.DOZ_PLUGIN_DIR` (absolut; kalau di-set tapi tidak ada → lempar error saat start dengan pesan jelas, jangan silent fallback)
2. `<userDataDir>/plugins` — hanya kalau ada (mode electron / setelah update)
3. `<studioDir>/../plugins` (dev + zip)
4. `<studioDir>/plugins` (zip yang menaruh plugins di dalam studio)
5. `<resourcesDir>/plugins` (bundel electron, read-only — dipakai sebagai **seed**, bukan tujuan tulis)

**Seeding (mode electron / pertama kali):** kalau `<userDataDir>/plugins` belum ada dan `<resourcesDir>/plugins` ada, copy rekursif sekali (`fs.cpSync(src, dst, { recursive: true })`), lalu tulis `<userDataDir>/plugins/.doz-seed.json` = `{ "contentVersion": "<versi app>", "seededAt": <epoch ms> }`. Alasan `pluginDir` harus writable: user mengedit komponen dari studio (`componentRepository.js` menulis ke `pluginDir`) dan S5 menimpa file plugin saat update. `resourcesDir` di dalam `.exe` terpaket read-only.

**`webDist`:** urutan `process.env.DOZ_WEB_DIST` → `<resourcesDir>/web/dist` → `<studioDir>/web/dist`. Jangan copy ke userData; aset web dilayani langsung dari lokasi read-only. Pengecualian: kalau S5 pernah memasang aset web baru, ia menaruhnya di `<userDataDir>/web/dist` dan itu **diprioritaskan di atas semua** (lihat S5).

**Env override yang harus didukung:** `DOZ_PLUGIN_DIR`, `DOZ_WEB_DIST`, `DOZ_RESOURCES_DIR`, `DOZ_USER_DATA_DIR`, `DOZ_STUDIO_PORT` (sudah ada), `DOZ_WORKDIR` (sudah ada). Semua dibaca lewat objek `env` yang sudah di-inject ke `createConfig({ env })` — jangan baca `process.env` langsung di dalam config.

### Config di app-data OS

| OS | `userDataDir` |
| --- | --- |
| Windows | `%APPDATA%\doz-studio` (`process.env.APPDATA`, fallback `~/AppData/Roaming/doz-studio`) |
| macOS | `~/Library/Application Support/doz-studio` |
| Linux/lain | `$XDG_CONFIG_HOME/doz-studio`, fallback `~/.config/doz-studio` |

Override: `DOZ_USER_DATA_DIR` (dipakai Electron main process dan test).

File: `<userDataDir>/config.json` (isi sama dengan `.local.json` lama: `workdir`, `anthropicApiKey`, `setup`, `sources`, ditambah `locale` dan `update` — lihat S2/S5) dan `<userDataDir>/usage.json`. Buat folder dengan `fs.mkdirSync(dir, { recursive: true })` sebelum tulis pertama.

**Migrasi sekali jalan** (idempoten, jalan di dalam `createConfig` sebelum baca pertama):
1. Kalau `<userDataDir>/config.json` **belum** ada dan `<studioDir>/.local.json` ada → copy isinya ke lokasi baru, lalu tulis `<studioDir>/.local.json.migrated` (penanda) dan **biarkan file lama apa adanya** (jangan hapus — user dev masih bisa pakai repo-nya). Log satu baris lewat `logger` bahwa migrasi dilakukan.
2. Hal yang sama untuk `<studioDir>/.usage.json` → `<userDataDir>/usage.json`.
3. Kalau kedua file sudah ada di lokasi baru, tidak ada aksi. Jangan merge dua sumber.
4. `anthropicApiKey` ikut pindah apa adanya (plain text, sama seperti sekarang). Setelah migrasi berhasil, file baru harus dibuat dengan mode `0o600` di POSIX (`fs.writeFileSync(file, data, { mode: 0o600 })`); Windows diabaikan.

### `DEFAULT_SOURCES` tanpa repo induk

`DEFAULT_SOURCES` tetap seperti sekarang tapi entri relatif di-resolve terhadap **`pluginDir`'s parent**, bukan `REPO_ROOT` yang mungkin salah:

```js
// baru: entri 'plugins/...' di-resolve relatif ke parent pluginDir
export const DEFAULT_SOURCES = Object.freeze({
  agents:    ['{plugins}/agents',    '{workdir}/.claude/agents'],
  skills:    ['{plugins}/skills',    '{workdir}/.claude/skills'],
  actions:   ['{plugins}/actions'],
  workflows: ['{plugins}/workflows', '{workdir}/.claude/workflows'],
});
```

- Placeholder baru `{plugins}` → `pluginDir`. `{workdir}` dan `~` tetap seperti sekarang (`config.js:58`).
- **Kompatibilitas ke belakang wajib:** config lama menyimpan `sources` dengan string `'plugins/agents'`. Saat membaca `saved.sources`, normalkan `^plugins/` → `{plugins}/`. Path relatif lain tetap di-resolve terhadap `repoRoot ?? pluginDir's parent ?? userDataDir`.
- `repoRoot` boleh `null`. Konsumen yang harus tahan `null`:

| File | Perilaku kalau `repoRoot === null` |
| --- | --- |
| `server/routes/systemRoutes.js:12` | `repoRoot: null` di payload `/api/status`; tambah field `mode: 'dev' \| 'standalone' \| 'packaged'` |
| `server/services/gitService.js:48` | `target === 'repo'` → lempar `badRequest('UPDATE_REPO_UNAVAILABLE')`… gunakan kode error, lihat S2 |
| `server/services/setupService.js:93,116` | Check "Repo doz-agent" di-skip: kembalikan `{ ok: null, skipped: true, ... }` bukan gagal |
| `server/services/folderService.js:28` | Shortcut "Repo doz-agent" tidak dimunculkan |
| `server/services/workflowService.js:40` | `path.relative(repoRoot, file)` → pakai `displayPath(file, { workdir, repoRoot })` yang sudah tahan `undefined` (`server/lib/paths.js:14`) |
| `server/repositories/componentRepository.js:51,73,172` | Prefix `doz-agent:` tetap ditentukan oleh `isInside(pluginDir, dir)` — tidak tergantung `repoRoot`, aman |

### Fallback port

- `createApp()` **tidak** lagi memanggil `server.listen`. Tambah export baru `startServer(options)` di `server/app.js` yang: merakit app, mencoba `listen(port, '127.0.0.1')`, dan kalau `err.code === 'EADDRINUSE'` mencoba `port+1` … sampai `port+9`; kalau masih gagal, `listen(0, '127.0.0.1')` (port acak dari OS). Return `Promise<{ server, config, port, url }>`.
- `DOZ_STUDIO_PORT` / `--port` yang eksplisit tetap dicoba lebih dulu; fallback tetap berlaku (jangan gagal keras) tapi log peringatan.
- **Cara UI tahu port yang dipakai:** UI selalu memakai **relative URL** (`/api/...`) dan WS `new URL('/ws', location.href)` dengan protokol `ws:`/`wss:` — jadi port otomatis benar karena UI dilayani oleh server yang sama. Tidak ada endpoint "discovery" yang diperlukan. Yang harus dilakukan S1:
  1. Tulis `<userDataDir>/runtime.json` = `{ "port": <port>, "url": "http://127.0.0.1:<port>", "pid": <pid>, "startedAt": <epoch ms> }` saat listen sukses; hapus file itu di `process.on('exit')`. Ini yang dibaca Electron main process (S3) untuk tahu URL yang harus dibuka.
  2. Tambahkan `port` ke payload `GET /api/status`.
  3. Mode dev (Vite di 5317) tetap pakai proxy ke `DOZ_STUDIO_PORT ?? 4317`; kalau server fallback ke port lain, dev harus set `DOZ_STUDIO_PORT`. Cukup dicatat di komentar `studio/scripts/dev.js`, tidak perlu logika tambahan.
- `server/index.js` jadi tipis: panggil `startServer()` lalu cetak banner (banner sekarang di `server/index.js`, pindahkan pemakaian `config.port` → `port` hasil `startServer`).

---

## S2 — i18n ID/EN

### Format kunci dan struktur file

- Library: **tanpa dependency i18n baru**. Tulis modul kecil sendiri (~60 baris) — project sudah punya pola serupa (`useTheme`) dan menghindari menambah paket ke bundel $20 app. Tidak boleh pakai `react-i18next`/`i18next`.
- Kunci: **dot-notation `namespace.subject.item`**, huruf kecil + kebab-case per segmen. Namespace = nama folder feature agar mudah dilacak: `topbar`, `sidebar`, `canvas`, `logs`, `settings`, `setup`, `dialogs`, ditambah `common` (tombol/label umum: `common.save`, `common.cancel`, `common.delete`, `common.close`, `common.retry`) dan `error` (pesan dari server, lihat di bawah).
  Contoh: `settings.workflow.parallel-max`, `setup.step.ai-brain.title`, `dialogs.git.commit-message`.
- File locale: `studio/web/src/i18n/locales/en.json` dan `studio/web/src/i18n/locales/id.json`. **Flat object** (kunci berisi titik sebagai string literal), bukan nested — supaya script pengecekan sederhana dan diff-nya bersih.

```json
{
  "common.save": "Save",
  "common.cancel": "Cancel",
  "settings.workflow.parallel-max": "Max parallel",
  "settings.workflow.budget": "Run budget ($)",
  "logs.empty.title": "No runs yet",
  "update.available.body": "Version {version} is available ({size})."
}
```

- **Interpolasi:** `{name}` diganti dari argumen kedua: `t('update.available.body', { version: '1.21.0', size: '184 KB' })`. Tidak ada pluralisasi otomatis; kalau butuh bentuk jamak, buat dua kunci (`...one` / `...other`) dan pilih di komponen. Jangan ada logika format di dalam file locale.
- **Bahasa sumber = `en`.** `en.json` adalah daftar kunci kanonik. `id.json` harus memiliki kunci yang **sama persis**.
- **Fallback:** locale tak dikenal / kunci tidak ada di locale aktif → pakai `en`. Kunci tidak ada di `en` juga → render kunci itu sendiri apa adanya (`settings.foo.bar`) dan `console.warn` sekali per kunci di mode dev. Jangan render string kosong.
- **Cara memuat:** kedua locale di-`import` statis di `studio/web/src/i18n/index.js` (total < 40 KB, tidak perlu lazy-load; menghindari flash bahasa salah saat start).

### API i18n untuk komponen

```js
// studio/web/src/i18n/index.js
export const LOCALES = ['en', 'id'];               // 'en' pertama = default
export function translate(locale, key, vars) {}    // murni, dipakai juga oleh test
// studio/web/src/i18n/I18nProvider.jsx
export function I18nProvider({ children }) {}      // simpan locale, expose context
export function useI18n() {}                       // -> { locale, setLocale, t }
```

- `I18nProvider` dipasang di `studio/web/src/main.jsx` **di luar** `ToastProvider` (toast juga perlu `t`).
- Komponen memakai `const { t } = useI18n()` lalu `t('common.save')`. **Tidak** ada string Indonesia/Inggris literal yang tersisa di JSX, `title=`, `aria-label=`, `placeholder=`, `alt=`, atau argumen `notify(...)`/`dialog.confirm(...)`.
- `document.documentElement.lang = locale` di-set oleh provider (a11y).

### Pesan error dari server: **kode error + UI yang menerjemahkan**

**Keputusan: server mengirim kode error; UI yang menerjemahkan.** Alasan: server lokal tidak punya konteks siapa yang melihat (satu server bisa dipakai dari beberapa tab/bahasa), tidak ada header locale yang sekarang dikirim, dan menaruh terjemahan di satu tempat (file locale FE) mencegah dua set string yang harus disinkronkan. Server tidak perlu tahu bahasa sama sekali → S1 dan S5 tidak terblokir oleh pekerjaan i18n.

Kontrak tambahan pada envelope error (kompatibel dengan `respond.js` sekarang — hanya menambah field):

```json
{
  "success": false,
  "error": "Folder tidak ada: E:\\tidak\\ada",
  "code": "WORKDIR_NOT_FOUND",
  "params": { "path": "E:\\tidak\\ada" },
  "details": []
}
```

| Field | Aturan |
| --- | --- |
| `code` | `SCREAMING_SNAKE_CASE`, opsional. Ada → UI cari kunci `error.<code-lowercase-kebab>` (`WORKDIR_NOT_FOUND` → `error.workdir-not-found`). |
| `params` | objek datar `string \| number \| boolean`, dipakai sebagai vars interpolasi. Opsional. |
| `error` | **tetap wajib** — pesan Inggris technical, dipakai sebagai fallback kalau `code` tidak ada atau kuncinya belum ada. Pesan operasional baru ditulis dalam **bahasa Inggris**. |
| `details` | array string (validasi zod). UI menampilkannya apa adanya di bawah pesan utama, tidak diterjemahkan. |

Backend (`be-1`, bagian dari S1):
- `ApiError` dapat parameter ke-4: `constructor(status, message, details, code)` — atau lebih rapi: opsi objek `{ details, code, params }`. Pilih bentuk `new ApiError(status, message, { details, code, params })` dan sesuaikan helper: `badRequest(message, opts)` dst. **Semua call-site lama tetap jalan** karena `details` sekarang dibaca dari `opts?.details`; call-site yang mengirim array langsung (`badRequest(msg, ['a'])`) harus dinormalkan: `Array.isArray(opts) ? { details: opts } : opts`.
- `respond.js` mengikutkan `code` dan `params` kalau ada; 500 generik memakai `code: 'INTERNAL_ERROR'`; ZodError memakai `code: 'VALIDATION_FAILED'` dan `error: 'Invalid input'`.
- Kode error yang **wajib** ada (dipakai FE, jangan diganti namanya): `INTERNAL_ERROR`, `VALIDATION_FAILED`, `NOT_FOUND`, `WORKDIR_NOT_FOUND`, `SOURCE_MISSING`, `REPO_UNAVAILABLE` (git target `repo` tanpa repo induk — S1), plus kode S5 di tabel Update di bawah.

Frontend:
- `studio/web/src/lib/api.js` → `ApiRequestError` dapat `.code` dan `.params`.
- Helper `studio/web/src/lib/errorMessage.js`: `errorMessage(t, err)` → `err.code ? t('error.' + kebab(err.code), err.params) : err.message`, dengan fallback ke `err.message` kalau kunci tidak ada. Semua tempat yang sekarang menampilkan `err.message` harus lewat helper ini.

### Di mana bahasa dipilih dan disimpan

| Tempat | Perilaku |
| --- | --- |
| **SetupWizard, langkah 0 (baru, paling atas)** | Pilihan bahasa "English / Bahasa Indonesia" sebagai `Step n={0}` atau blok di atas `Step n={1}` (lihat `SetupWizard.jsx:125`). Wajib tampil sebelum langkah lain. |
| **Settings** | Tambah pemilih bahasa di panel Settings yang sudah ada, satu baris di atas/di sebelah pemilih tema (`Field` + `Select`, lihat `SettingsPanel.jsx` dan `components/ui/Select.jsx`). |
| **Penyimpanan** | `localStorage` key `doz-studio:locale` lewat `readStorage`/`writeStorage` (`studio/web/src/lib/storage.js`), sama pola dengan `doz-studio:theme` di `hooks/useTheme.js`. **Tidak** disimpan ke config server — locale adalah preferensi tampilan, dan menyimpannya di server berarti round-trip untuk hal yang murni FE. |
| **Default pertama kali** | Tidak ada nilai tersimpan → deteksi dari `navigator.language`: diawali `id` → `id`, selain itu `en`. |

### Verifikasi tidak ada string tertinggal (AC-6)

Tiga cek, semuanya harus lolos, dijalankan lewat satu perintah baru `npm run i18n:check` di `studio/package.json`:

1. **Paritas kunci** — `en.json` dan `id.json` punya set kunci identik; tidak ada nilai kosong; tidak ada nilai `id` yang identik dengan `en` kecuali ada di allowlist `studio/scripts/i18n-allow-same.json` (untuk kata yang memang sama: "Git", "API", "Node.js").
2. **Kunci tak terpakai / tak terdefinisi** — pindai `studio/web/src/**/*.{js,jsx}` dengan regex `t\(\s*['"]([a-z0-9.\-]+)['"]`; setiap kunci yang dipakai harus ada di `en.json` (gagal kalau tidak), dan setiap kunci di `en.json` harus dipakai (peringatan, bukan gagal — kunci error server boleh belum dipakai).
3. **Sisa string hardcoded** — pindai JSX untuk teks literal yang kemungkinan besar copy UI: teks di antara tag (`>Teks<`) dan nilai atribut `title=`/`aria-label=`/`placeholder=`/`label=` yang berupa string literal dengan ≥ 2 karakter huruf. Abaikan: yang hanya simbol/angka/whitespace, yang di dalam `/* i18n-ignore */` satu baris di atasnya, dan file di `studio/web/src/i18n/`. Gagal (exit 1) kalau ada temuan.

Script: `studio/scripts/i18n-check.js`, Node murni tanpa dependency, print daftar temuan `path:baris  <cuplikan>` lalu `process.exit(1)`. Ditambahkan juga ke `npm test`? **Tidak** — biarkan perintah terpisah supaya `node --test` tetap cepat; CI memanggil keduanya (S3).

**Catatan scope penting:** ~460 string Indonesia hardcoded di 7 folder `studio/web/src/features/*` plus `components/ui/*`, `App.jsx`, dan `lib/model.js` (label `NODE_META`) harus dipindah ke locale. Label di `lib/model.js` dan `features/settings/options.js` adalah data, bukan JSX: ubah nilainya jadi **kunci i18n** (`label: 'canvas.node.agent'`) dan terjemahkan di titik render. Jangan meng-inject `t` ke dalam modul data.

---

## S5 — Update sekali klik

### Dua nomor versi: app vs content

| | App version | Content version |
| --- | --- | --- |
| Apa | binary (Electron + `server/**` di dalam `app.asar` + dependency) | `plugins/**` + aset `web/dist` yang dikirim lewat update |
| Sumber | `studio/package.json` → `config.appVersion` | `<userDataDir>/installed.json` → `.doz-seed.json` → (hanya mode dev) `appVersion` |
| Naik saat | `server/**`, `electron/**`, atau dependency berubah (perlu installer baru) | hanya konten plugins/web berubah |
| Field API | `appVersion` (`GET /api/status`, `GET /api/update/status`) | `contentVersion` (kedua endpoint yang sama) |
| Field manifest | `minAppVersion` (binary minimum yang boleh memasang manifest ini) | `contentVersion` (= content version yang dipasang manifest ini) |

Kenapa dipisah: update **tidak bisa** mengganti `server/**`. Aset web baru yang memanggil endpoint yang belum ada di binary lama akan merusak UI. `minAppVersion` adalah pengaman: rilis yang aset web-nya butuh endpoint baru harus menaikkan `minAppVersion` ke versi binary yang sudah punya endpoint itu. Aturan downgrade (`UPDATE_STALE_MANIFEST`) dan `updateAvailable` membandingkan **content version** saja; `minAppVersion` dibandingkan dengan **app version** saja.

### Bentuk manifest (dihosting di GitHub Releases / server user)

- Default endpoint: `https://github.com/<owner>/doz-agent/releases/latest/download/doz-update.json` (nilai konkret ditaruh sebagai konstanta `DEFAULT_UPDATE_ENDPOINT` di `server/infra/updateConfig.js`; kalau owner/repo belum pasti, pakai placeholder dan catat di Pertanyaan terbuka).
- Bisa diganti user: field `update.endpoint` di `<userDataDir>/config.json`, diubah lewat `PUT /api/update/settings`.
- **HTTPS wajib.** Skema selain `https:` → tolak sebelum request (`UPDATE_INSECURE_ENDPOINT`). Pengecualian tunggal: `http://127.0.0.1` / `http://localhost` **hanya** kalau `env.DOZ_UPDATE_ALLOW_HTTP === '1'` (untuk test otomatis). Jangan aktif secara default.
- Request header yang dikirim studio: `accept: application/json`, `user-agent: doz-studio/<appVersion>`, `cache-control: no-cache`. Timeout 10 detik (`AbortSignal.timeout(10_000)`). Maksimal 3 redirect, dan setiap redirect harus tetap `https:`.
- Manifest maksimal 1 MB; lebih dari itu → `UPDATE_MANIFEST_TOO_LARGE`.

```json
{
  "schema": 1,
  "contentVersion": "1.21.0",
  "releasedAt": "2026-09-20T02:00:00Z",
  "minAppVersion": "1.20.0",
  "notes": {
    "en": "- Bilingual UI (EN/ID)\n- One-click plugin updates\n- Fix: run log scroll jumps",
    "id": "- UI dua bahasa (EN/ID)\n- Pembaruan plugin sekali klik\n- Perbaikan: log run melompat"
  },
  "baseUrl": "https://github.com/<owner>/doz-agent/releases/download/v1.21.0/",
  "files": [
    { "path": "plugins/agents/backend-engineer.md", "target": "plugins", "url": "payload/plugins/agents/backend-engineer.md", "size": 8421, "sha256": "9f2c…" },
    { "path": "plugins/skills/ship-feature/SKILL.md", "target": "plugins", "url": "payload/plugins/skills/ship-feature/SKILL.md", "size": 21044, "sha256": "4ab1…" },
    { "path": "assets/index-Bk9x.js", "target": "web", "url": "payload/web/assets/index-Bk9x.js", "size": 412998, "sha256": "c07e…" },
    { "path": "index.html", "target": "web", "url": "payload/web/index.html", "size": 612, "sha256": "aa31…" }
  ],
  "removed": [
    { "path": "plugins/agents/old-agent.md", "target": "plugins" }
  ],
  "signature": {
    "alg": "ed25519",
    "keyId": "doz-2026a",
    "value": "<base64 signature dari canonical JSON manifest tanpa field `signature`>"
  }
}
```

| Field | Aturan validasi (zod, wajib semua) |
| --- | --- |
| `schema` | harus `1`. Lain → `UPDATE_SCHEMA_UNSUPPORTED`. |
| `contentVersion` | semver `x.y.z` (opsional `-pre`). Wajib. Nama lama `version` tidak lagi dikenal (manifest yang masih memakainya → `UPDATE_MANIFEST_INVALID`). |
| `minAppVersion` | **wajib**, semver. Manifest tanpa field ini → `UPDATE_MANIFEST_INVALID` (422): dianggap cacat, bukan diam-diam "cocok untuk semua binary" (itu justru membuka kembali jebakan UI rusak). Ikut ditandatangani (bagian canonical JSON), jadi mengubahnya tanpa kunci privat → `UPDATE_SIGNATURE_INVALID`. Kalau versi app < nilai ini → `UPDATE_REQUIRES_NEW_APP` (422) di `check` **dan** `apply`, sebelum file apa pun diunduh; UI mengarahkan user mengunduh installer baru. Sama dengan versi app = lolos. |
| `notes` | objek `{ en: string, id?: string }`. `en` wajib. Maks 20 000 karakter per bahasa. Dirender sebagai **teks biasa**, bukan HTML/Markdown-ke-HTML — jangan pakai `dangerouslySetInnerHTML`. |
| `baseUrl` | `https:`, diakhiri `/`. `url` tiap file di-resolve relatif ke sini (`new URL(file.url, baseUrl)`), dan host hasil resolve harus sama dengan host `baseUrl`. |
| `files[].target` | enum `'plugins' \| 'web'`. Menentukan folder tujuan: `plugins` → `pluginDir`, `web` → `<userDataDir>/web/dist`. Nilai lain → tolak. |
| `files[].path` | relatif POSIX. **Tolak** kalau: absolut, mengandung `..` segmen, diawali `/` atau `\`, mengandung `\` atau null byte, drive letter Windows (`^[A-Za-z]:`), atau setelah `path.resolve(targetDir, p)` hasilnya tidak `startsWith(targetDir + path.sep)`. Lihat pola yang sudah ada di `server/http/static.js` (cek `requested.startsWith(distDir)`) dan `server/lib/paths.js` (`isInside`). Tambahan: tolak symlink — file hasil unduhan selalu file biasa. |
| `files[].sha256` | 64 hex lowercase. Wajib. |
| `files[].size` | integer > 0, maks 20 MB per file; total semua file maks 80 MB. Body yang melebihi `size` saat diunduh → gagal. |
| `files` | 1–2000 entri. |
| `removed[]` | opsional, aturan `path`/`target` sama dengan `files`. Hanya boleh menghapus file di dalam target dir. |
| `signature` | **wajib.** Tidak ada / `alg` bukan `ed25519` / verifikasi gagal → `UPDATE_SIGNATURE_INVALID` dan **tidak ada** file yang diunduh. |

**Verifikasi signature:** public key ed25519 di-*hardcode* (base64 SPKI) di `server/infra/updateKeys.js` sebagai map `{ 'doz-2026a': '<base64>' }`; `keyId` yang tidak dikenal → `UPDATE_SIGNATURE_INVALID`. Verifikasi dengan `node:crypto` `crypto.verify(null, canonicalBytes, keyObject, signatureBytes)`. **Canonical JSON** = `JSON.stringify` dari manifest tanpa properti `signature`, dengan kunci objek diurutkan rekursif secara leksikografis dan tanpa whitespace. Tulis fungsi `canonicalJson(obj)` dan **unit test**-nya — signature akan gagal misterius kalau canonicalization beda.

### Endpoint internal studio

Prefix `/api/update`. Semua loopback-only (otomatis lewat `assertLocalRequest`). Envelope mengikuti konvensi `{ success, data }` / `{ success: false, error, code, params, details }`.

#### `GET /api/update/status`

Keadaan lokal saja, **tanpa** request jaringan. Dipanggil saat UI dibuka.

- Auth: loopback.
- Request: —
- Response 200:

```json
{
  "success": true,
  "data": {
    "appVersion": "1.20.0",
    "contentVersion": "1.20.0",
    "endpoint": "https://github.com/<owner>/doz-agent/releases/latest/download/doz-update.json",
    "endpointIsDefault": true,
    "lastCheckedAt": 1758950000000,
    "lastResult": "up-to-date",
    "available": null,
    "applying": false,
    "history": [
      { "contentVersion": "1.20.0", "appliedAt": 1758700000000, "files": 74, "skipped": 2 }
    ]
  }
}
```

`appVersion` = versi binary (`studio/package.json`); `contentVersion` = versi plugins + web terpasang (`installed.json`). Field `pluginVersion` lama dihapus (tanpa alias). `history[]` memakai `contentVersion` (entri lama yang tersimpan sebagai `version` dinormalkan saat dibaca). `GET /api/status` juga menyertakan `appVersion` dan `contentVersion` yang sama.

`lastResult`: `'up-to-date' | 'available' | 'error' | 'never'`. `available` berisi objek sama seperti `data` di `/api/update/check` kalau hasil cek terakhir menemukan versi baru, `null` kalau tidak.

#### Contoh manifest lengkap yang valid (untuk rilis pertama)

Nilai `sha256` dan `signature.value` di bawah hanya ilustrasi bentuk; hasil asli dihitung dari file rilis dan ditandatangani dengan `scripts/keygen.js`/kunci privat pemilik produk. Aturan yang dicek: semua field wajib ada, `baseUrl` https + diakhiri `/`, host `url` = host `baseUrl`, path relatif tanpa `..`, `sha256` 64 hex huruf kecil, `signature.value` base64 dari 64 byte.

```json
{
  "schema": 1,
  "contentVersion": "1.21.0",
  "minAppVersion": "1.20.0",
  "releasedAt": "2026-10-01T02:00:00Z",
  "notes": {
    "en": "- New agent prompts\n- Fix: run log scroll jumps",
    "id": "- Prompt agent baru\n- Perbaikan: log run melompat"
  },
  "baseUrl": "https://github.com/<owner>/doz-agent/releases/download/v1.21.0/",
  "files": [
    { "path": "plugins/agents/backend-engineer.md", "target": "plugins", "url": "payload/plugins/agents/backend-engineer.md", "size": 8421, "sha256": "9f2c1ab79f2c1ab79f2c1ab79f2c1ab79f2c1ab79f2c1ab79f2c1ab79f2c1ab7" },
    { "path": "assets/index-Bk9x.js", "target": "web", "url": "payload/web/assets/index-Bk9x.js", "size": 412998, "sha256": "c07e5d21c07e5d21c07e5d21c07e5d21c07e5d21c07e5d21c07e5d21c07e5d21" },
    { "path": "index.html", "target": "web", "url": "payload/web/index.html", "size": 612, "sha256": "aa31f0e4aa31f0e4aa31f0e4aa31f0e4aa31f0e4aa31f0e4aa31f0e4aa31f0e4" }
  ],
  "removed": [
    { "path": "plugins/agents/old-agent.md", "target": "plugins" }
  ],
  "signature": {
    "alg": "ed25519",
    "keyId": "doz-2026a",
    "value": "QUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQQ=="
  }
}
```

Checklist pemilik produk saat membuat rilis: (1) `minAppVersion` = versi binary terendah yang punya **semua** endpoint yang dipakai aset web di rilis ini; naikkan hanya kalau perlu, supaya user binary lama tidak dipaksa install ulang tanpa alasan. (2) `contentVersion` harus lebih tinggi dari content version rilis sebelumnya. (3) Tanda tangani **terakhir**, setelah semua field final.

#### `POST /api/update/check`

Unduh + validasi + verifikasi signature manifest. Tidak mengunduh file payload.

- Request body: `{}` atau `{ "endpoint": "https://..." }` (opsional, sekali pakai untuk uji endpoint tanpa menyimpannya).
- Response 200 (ada versi baru):

```json
{
  "success": true,
  "data": {
    "updateAvailable": true,
    "currentContentVersion": "1.20.0",
    "contentVersion": "1.21.0",
    "minAppVersion": "1.20.0",
    "releasedAt": "2026-09-20T02:00:00Z",
    "notes": { "en": "- Bilingual UI (EN/ID)\n…", "id": "- UI dua bahasa (EN/ID)\n…" },
    "fileCount": 76,
    "totalBytes": 1948221,
    "localEdits": [
      { "path": "plugins/agents/backend-engineer.md", "target": "plugins" }
    ],
    "checkedAt": 1758951111000
  }
}
```

- Response 200 (sudah terbaru): sama, dengan `"updateAvailable": false`, `contentVersion` = versi manifest, `notes`/`localEdits` tetap dikirim (boleh kosong).
- `localEdits` = file yang akan ditimpa **dan** sudah berbeda dari yang pernah dipasang studio (lihat "File yang diedit pembeli"). UI wajib menampilkan daftar ini sebelum tombol Update bisa ditekan.
- `check` menolak dengan `UPDATE_REQUIRES_NEW_APP` kalau `minAppVersion` > `appVersion`, sebelum apa pun dihitung/di-cache. `updateAvailable` = `contentVersion` manifest > `currentContentVersion`.
- Manifest hasil cek di-cache in-memory (bukan di disk) untuk dipakai `apply`. TTL 15 menit.

#### `POST /api/update/apply`

- Request body: `{ "contentVersion": "1.21.0", "overwriteLocalEdits": false }`
  - `contentVersion` wajib dan **harus** sama dengan versi manifest hasil `check` yang masih di cache. Tidak cocok / cache kadaluarsa → `UPDATE_STALE_MANIFEST` (409), UI harus `check` lagi.
  - `overwriteLocalEdits` default `false`. `false` + ada `localEdits` → file yang diedit **di-skip** (bukan gagal) dan dilaporkan di `skipped`. `true` → file diedit dibackup lalu ditimpa.
- Response 200:

```json
{
  "success": true,
  "data": {
    "contentVersion": "1.21.0",
    "applied": 74,
    "skipped": [
      { "path": "plugins/agents/backend-engineer.md", "target": "plugins", "reason": "local-edit" }
    ],
    "removed": 1,
    "backupDir": "C:\\Users\\x\\AppData\\Roaming\\doz-studio\\backups\\1758951200000",
    "reloadWeb": true,
    "durationMs": 8123
  }
}
```

`reloadWeb: true` kalau ada file `target: 'web'` yang berubah → UI harus memberi tahu user dan menawarkan reload (`location.reload()`), bukan reload otomatis di tengah pekerjaan.

Urutan eksekusi apply (wajib, transaksional):
0. `apply` memeriksa ulang `minAppVersion` vs `appVersion` (setelah cek `UPDATE_STALE_MANIFEST`) dan menolak `UPDATE_REQUIRES_NEW_APP` **sebelum** staging/unduhan.
1. Tolak kalau ada run aktif (`runLog`/`runService` punya run berstatus jalan) → `UPDATE_BUSY_RUN` (409). Alasan: `claude-cli` memakai `--plugin-dir` saat run berjalan.
2. Tolak kalau ada apply lain sedang jalan (flag in-memory) → `UPDATE_ALREADY_RUNNING` (409).
3. Unduh semua file ke folder staging `<userDataDir>/staging/<contentVersion>/`, hitung sha256 sambil menulis (`crypto.createHash('sha256')` di stream). Checksum tidak cocok / ukuran tidak cocok → hapus seluruh staging dan gagal `UPDATE_CHECKSUM_MISMATCH` (422) dengan `params: { path }`. **Tidak ada file target yang tersentuh** sebelum semua staging lolos.
4. Backup file target yang akan ditimpa/dihapus ke `<userDataDir>/backups/<epoch>/<target>/<path>`, plus tulis `manifest.json` backup.
5. Pindahkan dari staging ke target (`fs.renameSync`, fallback `copyFileSync`+`unlinkSync` kalau beda volume), buat folder induk sesuai kebutuhan.
6. Proses `removed`: hapus hanya kalau file itu masih identik dengan versi yang pernah dipasang (kalau sudah diedit → skip dengan `reason: 'local-edit'`).
7. Tulis state: `<userDataDir>/installed.json` = `{ contentVersion, appliedAt, files: { "<target>/<path>": "<sha256>" } }` (berkas lama berkunci `version` tetap terbaca; selalu ditulis dengan `contentVersion`) dan `update.history` di config (simpan maks 10 entri).
8. Kalau langkah 5/6 gagal di tengah: **rollback** dari backup lalu lempar `UPDATE_APPLY_FAILED` (500) dengan `params: { path }`. Backup tidak dihapus.
9. Bersihkan `staging/` (selalu, sukses maupun gagal). Backup lebih dari 3 generasi dihapus.

#### `GET /api/update/settings` · `PUT /api/update/settings`

- `PUT` body: `{ "endpoint": "https://example.com/doz-update.json" }` atau `{ "endpoint": null }` untuk kembali ke default.
- Validasi: HTTPS (kecuali pengecualian loopback di atas), panjang maks 2048, harus `new URL()` valid. Gagal → `UPDATE_INSECURE_ENDPOINT` (400).
- Response 200 (keduanya): `{ "success": true, "data": { "endpoint": "...", "endpointIsDefault": false } }`.

#### Tabel error

| Status | `code` | Kapan | Contoh body |
| --- | --- | --- | --- |
| 400 | `UPDATE_INSECURE_ENDPOINT` | endpoint bukan HTTPS | `{"success":false,"error":"Update endpoint must use HTTPS","code":"UPDATE_INSECURE_ENDPOINT","params":{"endpoint":"http://x/y.json"}}` |
| 400 | `VALIDATION_FAILED` | body request tidak lolos zod | `{"success":false,"error":"Invalid input","code":"VALIDATION_FAILED","details":["contentVersion: Required"]}` |
| 409 | `UPDATE_BUSY_RUN` | ada run workflow aktif | `{"success":false,"error":"Stop running workflows before updating","code":"UPDATE_BUSY_RUN"}` |
| 409 | `UPDATE_ALREADY_RUNNING` | apply lain sedang jalan | `{"success":false,"error":"An update is already in progress","code":"UPDATE_ALREADY_RUNNING"}` |
| 409 | `UPDATE_STALE_MANIFEST` | `contentVersion` tidak cocok / cache habis | `{"success":false,"error":"Update information is stale, check again","code":"UPDATE_STALE_MANIFEST"}` |
| 422 | `UPDATE_SIGNATURE_INVALID` | signature hilang/salah/keyId asing | `{"success":false,"error":"Update manifest signature is not valid","code":"UPDATE_SIGNATURE_INVALID"}` |
| 422 | `UPDATE_SCHEMA_UNSUPPORTED` | `schema !== 1` | `{"success":false,"error":"Unsupported manifest schema","code":"UPDATE_SCHEMA_UNSUPPORTED","params":{"schema":2}}` |
| 422 | `UPDATE_MANIFEST_INVALID` | manifest bukan JSON / gagal zod (termasuk `minAppVersion` hilang) / `baseUrl` beda host | `{"success":false,"error":"Update manifest is not valid","code":"UPDATE_MANIFEST_INVALID","details":["files.3.sha256: Invalid"]}` |
| 422 | `UPDATE_PATH_REJECTED` | path traversal / absolut / drive letter | `{"success":false,"error":"Update manifest contains an unsafe file path","code":"UPDATE_PATH_REJECTED","params":{"path":"../../../.claude/settings.json"}}` |
| 422 | `UPDATE_CHECKSUM_MISMATCH` | sha256/size file tidak cocok | `{"success":false,"error":"Downloaded file does not match its checksum","code":"UPDATE_CHECKSUM_MISMATCH","params":{"path":"plugins/agents/x.md"}}` |
| 422 | `UPDATE_MANIFEST_TOO_LARGE` | manifest > 1 MB atau total payload > 80 MB | `{"success":false,"error":"Update payload is too large","code":"UPDATE_MANIFEST_TOO_LARGE"}` |
| 422 | `UPDATE_REQUIRES_NEW_APP` | `minAppVersion` > versi app (di `check` dan `apply`) | `{"success":false,"error":"This update needs app version 1.22.0 or newer (installed: 1.20.0). Download and install the latest installer, then check for updates again.","code":"UPDATE_REQUIRES_NEW_APP","params":{"minAppVersion":"1.22.0","appVersion":"1.20.0"}}` |
| 503 | `UPDATE_UNREACHABLE` | offline, DNS gagal, timeout, status HTTP 4xx/5xx dari endpoint (termasuk 404 dan 500) | `{"success":false,"error":"Cannot reach the update server","code":"UPDATE_UNREACHABLE","params":{"status":404}}` |
| 500 | `UPDATE_APPLY_FAILED` | gagal saat memindahkan file, sudah di-rollback | `{"success":false,"error":"Update failed and was rolled back","code":"UPDATE_APPLY_FAILED","params":{"path":"plugins/skills/x/SKILL.md"}}` |
| 500 | `INTERNAL_ERROR` | bug tak terduga | `{"success":false,"error":"Terjadi kesalahan di server","code":"INTERNAL_ERROR"}` |

`UPDATE_UNREACHABLE` **tidak boleh** membuat studio gagal start atau merusak state apa pun (AC-10). `GET /api/update/status` harus selalu 200 walau offline.

### File yang diedit pembeli (AC-9)

Sumber kebenaran: `<userDataDir>/installed.json` yang mencatat sha256 setiap file yang **studio** pasang (dari seeding maupun update sebelumnya).

- File dianggap "diedit lokal" kalau: ada entri di `installed.json` **dan** sha256 file di disk sekarang ≠ sha256 tercatat.
- File yang ada di disk tapi **tidak** ada di `installed.json` (mis. komponen buatan user sendiri) dan tidak ada di daftar `files` manifest → tidak disentuh sama sekali.
- File yang ada di disk, tidak ada di `installed.json`, **tapi** ada di daftar `files` manifest → perlakukan sebagai edit lokal (konservatif): skip kalau `overwriteLocalEdits === false`.
- Kalau `installed.json` belum ada (instalasi lama), buat saat seeding/apply pertama dari isi disk saat itu, dan perlakukan apply pertama dengan `overwriteLocalEdits` sesuai pilihan user.
- Kalau ditimpa dengan `overwriteLocalEdits: true`, salinan lama **wajib** ada di `backupDir`, dan `backupDir` dikembalikan ke UI supaya user bisa mengambilnya. Tidak boleh ada penghapusan tanpa backup.

### FE update

- Entry point: tombol/ikon di TopBar (badge titik kalau `available`) yang membuka `UpdateDialog`.
- Alur: buka dialog → panggil `api.updateStatus()` → tombol "Check for updates" → `api.updateCheck()` → tampilkan versi, `releasedAt`, catatan rilis (`notes[locale] ?? notes.en`, render sebagai teks dengan `white-space: pre-wrap`) → kalau `localEdits.length > 0` tampilkan daftar + checkbox "Overwrite my edits (a backup is kept)" → tombol "Update now" → `api.updateApply({ contentVersion, overwriteLocalEdits })` → tampilkan hasil (`applied`, `skipped`, `backupDir`) → kalau `reloadWeb` tampilkan tombol "Reload".
- Field endpoint di Settings (`PUT /api/update/settings`), dengan tombol "Reset to default".
- Semua error lewat `errorMessage(t, err)` (S2). Kunci `error.update-*` untuk setiap `code` di tabel di atas harus ada di kedua locale.
- Selama `apply` berjalan: tombol disabled, tampilkan indikator indeterminate (tidak ada progress per-file di v1), dan **jangan** ada timeout di sisi klien lebih pendek dari 5 menit.

---

## S3 — Electron (batasan, bukan implementasi penuh)

Tanggung jawab devops-engineer. Tujuan: satu `.exe` Windows tanpa signing, struktur yang tidak menghalangi `.dmg` macOS lewat CI berikutnya.

### Struktur folder

```
studio/
  electron/
    main.js            # main process: siapkan env, start server, buat BrowserWindow
    preload.js         # minimal; tidak expose Node ke renderer (contextIsolation: true)
  build/
    icon.ico           # Windows
    icon.icns          # macOS (boleh placeholder di v1)
  package.json         # tambah "main": "electron/main.js" + blok electron-builder
```

### Isi bundel

| Di dalam bundel | Lokasi | Sifat |
| --- | --- | --- |
| kode server Node | `resources/app/server/**` (ikut `files` electron-builder) | read-only |
| aset web hasil `vite build web` | `resources/web/dist/**` (`extraResources`) | read-only |
| `plugins/` dari root repo | `resources/plugins/**` (`extraResources`, `from: "../plugins"`) | read-only, dipakai sebagai **seed** ke `<userData>/plugins` oleh S1 |
| `node_modules` runtime | ikut `app.asar` | `ws`, `zod`, `yaml`, `fflate`, `@anthropic-ai/sdk`. Paket `web`-only (react, vite, @xyflow, lucide) **tidak** boleh ikut — hanya devDependencies |

`asar: true`. `plugins/` dan `web/dist` **wajib di luar asar** (`extraResources`) karena dibaca dengan `fs` biasa dan disalin/dilayani sebagai file.

### Kontrak main process ↔ server (apa yang backend harus sediakan)

Ini yang S1 wajib sediakan agar S3 mungkin:

1. **`startServer()` bisa dipanggil sebagai modul**, bukan hanya lewat CLI:
   ```js
   import { startServer } from '<resources>/app/server/app.js';
   const { port, url, server } = await startServer({ env: process.env });
   ```
   Return `Promise<{ server, config, port, url }>`. `server/index.js` hanya wrapper CLI di atasnya. **Tidak ada `process.exit()` di dalam `app.js`/`config.js`** — error dilempar sebagai exception supaya main process bisa menampilkan dialog.
2. **Env yang di-set main process sebelum memanggil `startServer`:** `DOZ_RESOURCES_DIR=process.resourcesPath`, `DOZ_USER_DATA_DIR=app.getPath('userData')` (nama folder harus `doz-studio` — set `app.setName('doz-studio')` sebelum `app.getPath`), dan `DOZ_STUDIO_PORT` boleh dibiarkan kosong (fallback port dari S1 yang menentukan).
3. **URL yang dibuka BrowserWindow** = `url` hasil `startServer` (jangan hardcode 4317). `<userDataDir>/runtime.json` tersedia sebagai cadangan/diagnostik.
4. **Shutdown bersih:** panggil `server.close()` di `app.on('before-quit')`. S1 harus memastikan `runLog`/watcher tidak menahan proses hidup (gunakan `unref()` pada interval/watcher kalau ada).
5. Server tetap bind `127.0.0.1` saja. Jangan pernah `0.0.0.0`.

### Batasan Electron lain

- Satu instance saja: `app.requestSingleInstanceLock()`; instance kedua memfokuskan window yang ada.
- `BrowserWindow`: `webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }`. Renderer tetap app web biasa yang bicara HTTP ke `127.0.0.1` — **tidak ada IPC untuk fitur produk**. Tambahan: `setWindowOpenHandler` → link eksternal dibuka di browser OS (`shell.openExternal`), bukan di dalam app.
- `claude` CLI dan `git` dipanggil lewat spawn dari server; app **tidak** membundel keduanya. Kalau tidak ada di PATH, SetupWizard yang memberi tahu (sudah jalan hari ini). Catat di dokumentasi rilis bahwa PATH GUI di Windows kadang berbeda dari terminal — main process harus meneruskan `process.env` apa adanya, jangan bikin env bersih.
- Tanpa code signing v1: konsekuensi SmartScreen didokumentasikan di `README`/halaman Gumroad (bukan pekerjaan kode).
- CI: workflow GitHub Actions `windows-latest` → `npm ci` di `studio` → `npm run build` → `npm run i18n:check` → `npx electron-builder --win nsis --publish never` → unggah artifact `.exe`. Susun job dengan `strategy.matrix.os` yang saat ini hanya `[windows-latest]` supaya `macos-latest` cukup ditambahkan nanti; jangan tulis langkah yang khusus Windows di luar matrix (mis. path `\`), dan jangan panggil `electron-builder --win` di luar step yang di-gate `matrix.os`.
- Skrip `package.json` baru yang harus ada: `"build:web"` (alias `vite build web`), `"dist:win"`, dan `"i18n:check"`. Jangan hapus/ubah arti `dev`, `start`, `build`, `test` yang sudah ada.

---

## Data

Tidak ada database. Perubahan penyimpanan file:

| File | Status | Isi | Migrasi / rollback |
| --- | --- | --- | --- |
| `studio/.local.json` | lama, **tidak dihapus** | workdir, anthropicApiKey, setup, sources | Dibaca sekali lalu dicopy ke lokasi baru; penanda `.local.json.migrated` dibuat. Rollback = hapus `<userDataDir>/config.json` |
| `studio/.usage.json` | lama, tidak dihapus | cache pemakaian | idem → `<userDataDir>/usage.json` |
| `<userDataDir>/config.json` | **baru** | field lama + `locale` (opsional, tidak dipakai FE v1) + `update: { endpoint, history[] }` | mode `0o600` di POSIX |
| `<userDataDir>/usage.json` | **baru** | sama seperti `.usage.json` | — |
| `<userDataDir>/runtime.json` | **baru** | `{ port, url, pid, startedAt }` | ephemeral, dihapus saat exit |
| `<userDataDir>/installed.json` | **baru** | `{ contentVersion, appliedAt, files: { "<target>/<path>": sha256 } }` (terbaca juga kunci lama `version`) | hilang → dibuat ulang dari disk; efeknya semua file dianggap mungkin-diedit (konservatif, aman) |
| `<userDataDir>/plugins/**` | **baru** (mode packaged) | hasil seed dari `resources/plugins` + hasil update | hapus folder → seed ulang saat start berikutnya |
| `<userDataDir>/web/dist/**` | **baru** | aset web hasil update, menang atas bundel | hapus folder → kembali ke aset bundel |
| `<userDataDir>/staging/<contentVersion>/**` | **baru**, ephemeral | unduhan yang belum diverifikasi | selalu dibersihkan |
| `<userDataDir>/backups/<epoch>/**` | **baru** | salinan file sebelum ditimpa | simpan 3 generasi terakhir |
| `localStorage doz-studio:locale` | **baru** | `'en' \| 'id'` | — |

**Dampak ke data lama:** user dev yang menjalankan dari repo tetap melihat workdir, API key, dan sources-nya (lewat migrasi). Workflow dan run tetap di `<workdir>/.doz-studio/` — tidak berubah.

---

## Peta file

Satu file = satu pemilik. Jangan menyentuh file yang bukan milikmu.

### Backend — S1 (`be-1`)

- [S1] `studio/server/infra/runtimePaths.js` — **buat** — deteksi mode (`dev`/`standalone`/`packaged`), resolusi `studioDir`, `resourcesDir`, `userDataDir`, `pluginDir`, `webDist`, `repoRoot (nullable)`; seeding `plugins` dari resources; export `detectRuntimePaths({ env, here })`. Murni dan bisa dites dengan env tiruan. (pola: perhitungan path di `studio/server/infra/config.js:8-13`, helper `isInside` di `studio/server/lib/paths.js`)
- [S1] `studio/server/infra/configStore.js` — **buat** — baca/tulis `<userDataDir>/config.json` dengan mode `0o600`, plus migrasi sekali jalan dari `studio/.local.json` dan `studio/.usage.json`. (pola: `createLocalFile` di `studio/server/infra/config.js:34-49` — pindahkan dan perluas)
- [S1] `studio/server/infra/config.js` — **ubah** — pakai `runtimePaths.js` + `configStore.js`; `repoRoot` boleh `null`; `DEFAULT_SOURCES` pakai `{plugins}`; `resolveSource` menormalkan prefix `plugins/` lama; `usageFile` → `<userDataDir>/usage.json`; hapus `STUDIO_DIR`/`REPO_ROOT`/`PLUGIN_DIR`/`WEB_DIST` sebagai export top-level (jadi properti config) tapi **pertahankan export `SOURCE_KINDS`** (dipakai `routes/systemRoutes.js:2`)
- [S1] `studio/server/app.js` — **ubah** — tambah export `startServer(options)` (listen + fallback port + tulis `runtime.json` + hapus saat exit) dan **sisipkan baris slot untuk S5** tepat setelah `registerSetupRoutes(...)`:
  `// slot S5: registerUpdateRoutes(router, { update: createUpdateService({ config, isRunActive: () => runs.hasActive() }) });` — tulis sebagai komentar satu baris persis seperti itu supaya `be-2` hanya mengaktifkannya. Sediakan juga `runs.hasActive()` bila belum ada (lihat di bawah).
- [S1] `studio/server/index.js` — **ubah** — pakai `await startServer()`, banner memakai `port` hasilnya
- [S1] `studio/server/lib/errors.js` — **ubah** — `ApiError(status, message, opts)` dengan `{ details, code, params }`; helper menerima `opts`; normalkan `opts` berupa array jadi `{ details: opts }` untuk call-site lama
- [S1] `studio/server/http/respond.js` — **ubah** — kirim `code` + `params` kalau ada; `INTERNAL_ERROR` untuk 500; `VALIDATION_FAILED` + `error: 'Invalid input'` untuk ZodError
- [S1] `studio/server/routes/systemRoutes.js` — **ubah** — payload `/api/status` tambah `port`, `mode`, `userDataDir`; `repoRoot` boleh `null`
- [S1] `studio/server/services/gitService.js` — **ubah** — `target === 'repo'` tanpa repo induk → `badRequest('Repository is not available in this installation', { code: 'REPO_UNAVAILABLE' })` (baris rujukan: `:48`)
- [S1] `studio/server/services/setupService.js` — **ubah** — check "Repo doz-agent" jadi `skipped` kalau `repoRoot === null` (baris rujukan: `:93`, `:116`)
- [S1] `studio/server/services/folderService.js` — **ubah** — shortcut "Repo doz-agent" hanya kalau `repoRoot` ada (baris rujukan: `:28`)
- [S1] `studio/server/services/runService.js` — **ubah** — tambah `hasActive()` yang mengembalikan `true` kalau ada run berjalan (dipakai guard `UPDATE_BUSY_RUN`). Kalau informasinya sudah ada di `repositories/runLogRepository.js`, cukup delegasikan.
- [S1] `studio/server/http/schemas.js` — **ubah** — tambah komentar slot di akhir file: `// slot S5: skema update (updateCheckBody, updateApplyBody, updateSettingsBody, updateManifest)` supaya `be-2` menambah di satu tempat tanpa konflik
- [S1] `studio/tests/runtimePaths.test.js` — **buat** — 3 mode resolusi + `DOZ_PLUGIN_DIR` override + `DOZ_PLUGIN_DIR` tidak ada → error (pola: file di `E:\Business\doz-agent\tests`, runner `node --test`)
- [S1] `studio/tests/configMigration.test.js` — **buat** — migrasi dari `.local.json`, idempoten, tidak menimpa config baru yang sudah ada
- [S1] `studio/tests/portFallback.test.js` — **buat** — port terpakai → server pindah port dan `runtime.json` berisi port itu

### Backend — S5 (`be-2`)

- [S5] `studio/server/infra/updateKeys.js` — **buat** — map `keyId` → public key ed25519 base64 SPKI + `verifyManifestSignature(manifest)`; `canonicalJson(obj)`
- [S5] `studio/server/infra/updateConfig.js` — **buat** — `DEFAULT_UPDATE_ENDPOINT`, `resolveEndpoint(config)`, validasi HTTPS (+ pengecualian loopback lewat `DOZ_UPDATE_ALLOW_HTTP`)
- [S5] `studio/server/services/updateService.js` — **buat** — `status()`, `check({ endpoint })`, `apply({ contentVersion, overwriteLocalEdits })`, `getSettings()`, `setSettings({ endpoint })`; unduh + sha256 streaming + staging + backup + rollback + `installed.json`; cache manifest in-memory TTL 15 menit; guard `isRunActive()` dan flag apply. (pola service: factory `createXxxService({ config, ... })` di `studio/server/services/setupService.js`)
- [S5] `studio/server/routes/updateRoutes.js` — **buat** — `registerUpdateRoutes(router, { update })` untuk 5 endpoint di atas (pola: `studio/server/routes/setupRoutes.js` — route tipis, `schema.parse` di route)
- [S5] `studio/server/http/schemas.js` — **ubah** — **hanya** menambahkan blok skema update di slot yang disiapkan S1 di akhir file: `updateCheckBody`, `updateApplyBody`, `updateSettingsBody`, `updateManifest` (termasuk validasi path traversal sebagai `.refine`) (pola: `studio/server/http/schemas.js` keseluruhan)
- [S5] `studio/server/app.js` — **ubah** — **hanya** mengubah satu baris komentar slot S5 menjadi kode aktif + menambah dua baris import. Tidak boleh mengubah bagian lain file ini (dimiliki `be-1`). Jalankan setelah S1 `done`.
- [S5] `studio/tests/updateManifest.test.js` — **buat** — `canonicalJson` stabil terhadap urutan kunci; signature valid/invalid; `schema` salah; `minAppVersion`
- [S5] `studio/tests/updatePathSafety.test.js` — **buat** — tolak `../`, path absolut, drive letter `C:`, backslash, null byte, `target` asing
- [S5] `studio/tests/updateApply.test.js` — **buat** — checksum mismatch → tidak ada file target berubah; file diedit lokal → skip + dilaporkan; `overwriteLocalEdits: true` → ada backup; gagal di tengah → rollback; endpoint 404 → `UPDATE_UNREACHABLE` dan status tetap 200

### Frontend — S2 (`fe-1`)

- [S2] `studio/web/src/i18n/index.js` — **buat** — `LOCALES`, `translate(locale, key, vars)`, `kebabFromCode(code)`, deteksi default dari `navigator.language`
- [S2] `studio/web/src/i18n/I18nProvider.jsx` — **buat** — context + `useI18n()`; persist ke `doz-studio:locale`; set `document.documentElement.lang` (pola persist: `studio/web/src/hooks/useTheme.js`)
- [S2] `studio/web/src/i18n/locales/en.json` — **buat** — sumber kanonik semua kunci (flat, dot-notation)
- [S2] `studio/web/src/i18n/locales/id.json` — **buat** — terjemahan dengan set kunci identik
- [S2] `studio/web/src/lib/errorMessage.js` — **buat** — `errorMessage(t, err)` dari `err.code`/`err.params`, fallback `err.message`
- [S2] `studio/web/src/lib/api.js` — **ubah** — `ApiRequestError` membawa `code` dan `params` dari body; pesan fallback koneksi jadi kunci i18n (`error.server-unreachable`) — kembalikan `code: 'SERVER_UNREACHABLE'` alih-alih kalimat Indonesia (baris rujukan: `:19-25`)
- [S2] `studio/web/src/main.jsx` — **ubah** — bungkus dengan `<I18nProvider>` paling luar setelah `ErrorBoundary`
- [S2] `studio/web/src/App.jsx` — **ubah** — ganti semua string UI dengan `t(...)`
- [S2] `studio/web/src/lib/model.js` — **ubah** — nilai `label`/`description` di `NODE_META` jadi kunci i18n; diterjemahkan di titik render
- [S2] `studio/web/src/features/settings/options.js` — **ubah** — label opsi jadi kunci i18n
- [S2] `studio/web/src/features/settings/SettingsPanel.jsx` — **ubah** — `t(...)` + **tambah pemilih bahasa** (`Field` + `Select`, di dekat pemilih tema)
- [S2] `studio/web/src/features/settings/{NodeSettings,SettingsFields}.jsx` — **ubah** — `t(...)`
- [S2] `studio/web/src/features/setup/SetupWizard.jsx` — **ubah** — `t(...)` + **langkah pemilihan bahasa paling atas** (pola `Step` di `:9-14`, langkah pertama di `:125`)
- [S2] `studio/web/src/features/setup/CheckRow.jsx` — **ubah** — `t(...)`
- [S2] `studio/web/src/features/topbar/**`, `sidebar/**`, `canvas/**`, `logs/**`, `dialogs/**` — **ubah** — `t(...)` di semua string UI termasuk `title`, `aria-label`, `placeholder`
- [S2] `studio/web/src/components/ui/**` — **ubah** — `t(...)` (`Toast`, `Dialogs`, `ErrorBoundary`, `Modal`, `Field`, `Select`)
- [S2] `studio/scripts/i18n-check.js` — **buat** — 3 cek di "Verifikasi tidak ada string tertinggal"; exit 1 + daftar `path:baris`
- [S2] `studio/scripts/i18n-allow-same.json` — **buat** — allowlist string yang sengaja sama di kedua locale
- [S2] `studio/package.json` — **ubah** — tambah script `"i18n:check": "node scripts/i18n-check.js"`. **Hanya baris itu.** (`devops-1` menambah `build:web`/`dist:win`/`main` di file yang sama — koordinasi: `fe-1` menambah lebih dulu, `devops-1` menambah setelah S2 `done`; `devops-1` adalah pemilik akhir file ini)

### Frontend — S5 (`fe-2`)

- [S5] `studio/web/src/features/update/UpdateDialog.jsx` — **buat** — alur check → notes → localEdits + checkbox overwrite → apply → hasil + tombol Reload (pola modal: `studio/web/src/features/dialogs/GitDialog.jsx`, lazy-load seperti `studio/web/src/App.jsx:19-25`)
- [S5] `studio/web/src/features/update/UpdateSettings.jsx` — **buat** — field endpoint + tombol "Reset to default", dipasang di panel Settings
- [S5] `studio/web/src/hooks/useUpdate.js` — **buat** — state `status/checking/applying/error` + pemanggilan API (pola hook: `studio/web/src/hooks/useRuns.js`)
- [S5] `studio/web/src/lib/api.js` — **ubah** — tambah `updateStatus`, `updateCheck`, `updateApply`, `updateSettings`, `saveUpdateSettings`. **Hanya menambah baris di objek `api`** (pemilik file: `fe-1`; kerjakan setelah S2 `done`)
- [S5] `studio/web/src/features/topbar/TopBar.jsx` — **ubah** — tombol + badge "update available" yang membuka `UpdateDialog`. (pemilik file: `fe-1`; kerjakan setelah S2 `done`)
- [S5] `studio/web/src/i18n/locales/{en,id}.json` — **ubah** — tambah kunci `update.*` dan `error.update-*` untuk semua `code` di tabel error. (pemilik file: `fe-1`; kerjakan setelah S2 `done`)

### DevOps — S3 (`devops-1`)

- [S3] `studio/electron/main.js` — **buat** — `app.setName('doz-studio')`, set `DOZ_RESOURCES_DIR`/`DOZ_USER_DATA_DIR`, `await startServer()`, `BrowserWindow` ke `url` hasilnya, single-instance lock, `setWindowOpenHandler` → `shell.openExternal`, `server.close()` di `before-quit`, dialog error kalau `startServer` melempar
- [S3] `studio/electron/preload.js` — **buat** — minimal/kosong; `contextIsolation: true`, tidak expose API Node
- [S3] `studio/package.json` — **ubah** — `"main": "electron/main.js"`, script `build:web`/`dist:win`, blok `build` electron-builder (`appId`, `productName`, `files`, `extraResources` untuk `../plugins` dan `web/dist`, `asar: true`, target `nsis`, `win.icon`, `mac.target: dmg` disiapkan tapi tidak dibangun di v1), `electron` + `electron-builder` sebagai devDependencies. **Jangan** ubah script `dev`/`start`/`build`/`test`/`i18n:check`
- [S3] `studio/build/icon.ico` — **buat** — ikon Windows (boleh placeholder)
- [S3] `studio/build/icon.icns` — **buat** — placeholder macOS
- [S3] `studio/electron-builder.env.example` / `studio/.gitignore` — **ubah/buat** — abaikan `studio/dist-electron/`, `studio/web/dist/`
- [S3] `.github/workflows/desktop-build.yml` — **buat** — matrix `os: [windows-latest]` (siap ditambah `macos-latest`), langkah: checkout → setup-node 20 → `npm ci` di `studio` → `npm run i18n:check` → `npm test` → `npm run build:web` → `npx electron-builder --publish never` → upload artifact. Pin action ke SHA. Tanpa signing (`CSC_IDENTITY_AUTO_DISCOVERY=false`)
- [S3] `docs/desktop-install.md` — **buat** — catatan rilis untuk pembeli: peringatan SmartScreen (tanpa signing), `claude` CLI + git harus ada di PATH, lokasi config app-data per OS, cara reset (hapus folder app-data)

---

## Pertanyaan terbuka & asumsi

1. **Owner/repo GitHub untuk endpoint update default belum diketahui dari spec ini.** Rekomendasi: `be-2` memakai konstanta `DEFAULT_UPDATE_ENDPOINT = 'https://github.com/<owner>/doz-agent/releases/latest/download/doz-update.json'` dengan `<owner>` diisi dari `git remote get-url origin` saat menulis kode, dan gagal-lunak (`UPDATE_UNREACHABLE`) kalau salah. Terdampak: `S5 › updateConfig.js`, contoh manifest, `GET /api/update/status.endpoint`.
2. **Pasangan kunci ed25519 untuk menandatangani manifest belum ada.** Private key TIDAK boleh masuk repo. Rekomendasi: generate sekarang, simpan private key di GitHub Secret (`DOZ_UPDATE_SIGNING_KEY`), commit hanya public key ke `server/infra/updateKeys.js` dengan `keyId: 'doz-2026a'`. Untuk sementara `be-2` boleh menaruh key hasil generate lokal dan menandai `TODO(release)`. Terdampak: `S5 › updateKeys.js`, AC-8, dan sebuah langkah signing di CI yang **belum** ada di Peta file S3.
3. **Siapa yang membangun `doz-update.json` + payload saat rilis?** Rekomendasi: script `studio/scripts/build-update-manifest.js` (milik `devops-1`, tambahan setelah S3) yang memindai `plugins/` + `web/dist`, menghitung sha256, dan menandatangani dengan key dari env. Tidak diperlukan agar S5 bisa dites (test memakai manifest buatan tangan), jadi sengaja tidak masuk v1 slice.
4. **Versi app sebagai sumber `appVersion`; `contentVersion` (dulu `pluginVersion`) sebagai versi konten.** Asumsi: `studio/package.json` `version` (sekarang `0.1.0`) dinaikkan mengikuti `CHANGELOG.md` root (`1.20.0`). Rekomendasi: satukan — set `studio/package.json` ke `1.20.0` sebelum rilis pertama, dan `contentVersion` dibaca dari `installed.json` → seed (fallback `appVersion` hanya di mode dev). Dua nomor ini dijelaskan di "Dua nomor versi: app vs content". Keputusan penomoran ini milik pemilik produk. Terdampak: `GET /api/update/status`, `minAppVersion`, `user-agent`.
5. **`plugins/actions`** disebut di `DEFAULT_SOURCES` tapi tidak dikonfirmasi ada di repo. Asumsi: kalau folder tidak ada, `sourceDirs()` sudah menyaringnya (`config.js:91`) — tidak ada perubahan perilaku yang diperlukan.
6. **File instruksi di `plugins/**` harus diterjemahkan ke Inggris** (keputusan final: Inggris satu-satunya sumber). Itu pekerjaan konten, **bukan** bagian dari S1/S2/S3/S5 dan tidak ada di Peta file. Rekomendasi: slice terpisah `S4` (penulisan ulang konten agent/skill ke Inggris) yang dijadwalkan setelah S2, karena volumenya besar dan tidak memblokir kode mana pun.
7. **Pesan operasional server yang sudah ada masih bahasa Indonesia** (mis. `'Folder tidak ada: …'`, `'Terjadi kesalahan di server'`). Asumsi: `be-1` menambahkan `code` untuk pesan yang ditampilkan ke user dan **menulis pesan `error` baru dalam bahasa Inggris**; pesan lama boleh dibiarkan sampai punya `code` karena FE mengutamakan `code`. Terdampak: kunci `error.*` di `en.json`/`id.json` (S2) harus mencakup daftar kode di S2 + tabel S5.
