## Studio server  (commit: 22ef406, S1 belum di-commit)
Alur:  server/index.js → startServer() (app.js) → createApp() → createConfig() (infra/config.js)
       → detectRuntimePaths (infra/runtimePaths.js) + configStore.js (migrasi .local.json → app-data)
File:  studio/server/app.js · infra/config.js · infra/runtimePaths.js · infra/configStore.js · lib/errors.js · http/respond.js
Pola:  envelope {success,data} / {success:false,error,code?,params?,details?}; ApiError(status,msg,{details,code,params}); route tipis, zod di schemas.js
Jebakan: tes lama di studio/test/ (spec bilang tests/, keduanya ikut node --test); createConfig({localFile}) = mode tes, tanpa migrasi/app-data;
       startServer(port 0) harus [0] saja; tes butuh DOZ_RESOURCES_DIR agar repoRoot null (repo asli = mode dev);
       baseline Windows: 2 tes lama gagal (tool api path, runner claude-cli); web-model.test gagal kalau i18n FE belum ada

## Update sekali klik (S5-BE)
Alur:  /api/update/* → routes/updateRoutes.js → services/updateService.js (check/apply, cache TTL 15m, staging→backup→move→rollback)
File:  infra/updateKeys.js (canonicalJson, verify; PUBLIC_KEYS placeholder) · infra/updateConfig.js · http/schemas.js (updateManifest, isSafeRelativePath) · scripts/keygen.js
Jebakan: target plugins → path manifest diawali `plugins/` (dibuang saat tulis ke pluginDir); kunci installed.json = `<target>/<path>`;
       signature diverifikasi pada objek MENTAH sebelum zod; tes pakai tests/updateFixture.js (keypair + server HTTP lokal, DOZ_UPDATE_ALLOW_HTTP=1);
       createConfig di tes wajib `here` palsu, kalau tidak .local.json asli ikut termigrasi; config.webDist sekarang getter

## i18n sisi server
Pola: teks buat UI = `code` + `params` + fallback Inggris. HTTP: ApiError opts; setup item: `code`/`fixCode`; run engine: CodedError (`codeOf(err)`), event `code/params`, node `errorCode/activityCode/warningCode`.
Jebakan: `err.code` sistem (ENOENT) jangan dipakai sebagai kode UI — lewat codeOf() saja; static.js: path.normalize pada pathname absolut tidak bisa keluar dist, tapi decodeURIComponent rusak melempar URIError.

## Rahasia & hardening (SEC batch)
File:  infra/apiKeyStore.js (codec Electron → anthropicApiKeyEnc) · lib/secretEnv.js (childEnv scrub key studio) · http/static.js (nosniff, CSP hash inline)
Jebakan: startServer({ secretCodec:{encrypt,decrypt} }) disuntik main.js; kode baru UPDATE_ROLLBACK_INCOMPLETE butuh kunci locale FE (test/i18n-codes menjaga)
Overlay web: static.js createStaticHandler(dist, overlay); config.webDist (getter) + config.webOverlay = <userData>/web/dist. Backup layout: backupDir/<target>/<relativeInTarget>.

## Versi app vs content (update)
Alur:  status() → {appVersion, contentVersion}; check/apply → assertAppCompatible(manifest) (minAppVersion wajib, signed otomatis karena payload = semua field kecuali signature); /api/status ikut dua field (updateService.contentVersion disuntik ke registerSystemRoutes)
Jebakan: semua nama sudah `contentVersion` (manifest, installed.json, seed, history, apply body/hasil); berkas lama berkunci `version` dibaca via versionOf(), history lama dinormalkan di status(); kode UPDATE_REQUIRES_NEW_APP params {minAppVersion, appVersion}; tests/updateFixture buildManifest default minAppVersion 1.0.0; test bisa ubah env.config.appVersion (properti biasa)
