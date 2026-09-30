# Memory frontend-engineer (doz studio)
Repo: studio/ = React 19 + Vite 8 (web/), Node ESM server. Tanpa linter. Perintah dari studio/: `npm test`, `npm run build`, `npm run i18n:check`.
Test web murni Node (`node --test`, tanpa jsdom); logika UI diuji lewat lib/*.js.
Baseline test gagal di Windows (bukan FE): engine.test 'tool api' (path POSIX), runners.test menggantung.

## Fitur
- i18n: lihat i18n.md

## Pelajaran review
- Hasil cek/data server yang basi tidak boleh tetap dirender di samping error terbaru; error dan hasil saling eksklusif (canApply/section pakai `&& !error`).
- Request async yang bisa saling menimpa (refresh status) pakai createLatest() (lib/latest.js) + cancel saat unmount.
- Tombol aksi jangan di-unmount saat proses jalan (fokus keyboard hilang); pakai disabled.
- Load awal yang bisa gagal harus punya tombol retry, jangan mengunci input selamanya.
- Jangan mutasi state global di body render (locale); formatter menerima t/intl dari useI18n().
- String ber-{count} wajib .one/.other (helper tp / plural); i18n:check menegakkan pasangannya.
- Script inline dilarang (CSP script-src 'self'): pakai file di web/public.
- Tampilan yang butuh JSX tidak bisa diuji Node tanpa jsdom: ekstrak logika ke lib/*.js agar bisa dites.
