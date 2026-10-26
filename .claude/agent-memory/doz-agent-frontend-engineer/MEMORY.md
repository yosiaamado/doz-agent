# Memory frontend-engineer (doz studio)
Repo: studio/ = React 19 + Vite 8 (web/), Node ESM server. Tanpa linter. Perintah dari studio/: `npm test`, `npm run build`, `npm run i18n:check`.
Test web: logika murni lewat node --test; render lewat scripts/ui-smoke.js (jsdom, klik-jelajah dialog). Mock API ada di skrip itu: tambahkan route baru kalau fitur baru memanggil endpoint saat mount.
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
- Variabel loop/callback jangan bernama `t` di komponen yang memakai t() dari useI18n (membayangi terjemahan -> "t is not a function" saat render). Bug ini lolos karena tidak ada test render; sekarang scripts/ui-smoke.js (jsdom + vite ssrLoadModule) dijalankan test/ui-smoke.test.js untuk en dan id.
- Profiles (S1 FE): lihat profiles.md
- Activity stream (S2 FE): lihat activity.md
- Chat (S3 FE): lihat chat.md
- [Office view + restyle](office.md)
- Browser check without a browser tool: DOZ_STUDIO_PORT=4391 node server/index.js, then headless Chrome via remote-debugging + ws (set localStorage doz-studio:view/theme).
