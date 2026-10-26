# Memory backend-engineer (doz-agent)
- Repo: studio/ Node 20 ESM tanpa framework. Test `cd studio && npm test` (node --test), build `npm run build` (vite; bisa gagal karena kerja FE paralel).
- Error envelope custom (bukan RFC 9457) — ikuti respond.js. Komentar/pesan lama bahasa Indonesia, pesan baru Inggris + `code`.
- Tool Bash: heredoc dengan backslash/kutip tunggal rawan; pakai Write/Edit untuk file berisi regex `\`.
- [Studio server](studio-server.md) — path runtime, config app-data, startServer, kode error
- [Studio profiles](studio-profiles.md) — multi-akun Claude: profileStore/Service, spawnEnv, env per spawn

## Pelajaran review (security)
- `writeFileSync({mode})` = no-op di Windows dan tidak memperketat file lama; rahasia butuh enkripsi (safeStorage codec) + chmod eksplisit POSIX.
- Escape hatch env (mis. DOZ_UPDATE_ALLOW_HTTP) harus dikunci ke runtime test (NODE_TEST_CONTEXT/NODE_ENV=test), bukan hanya flag.
- Cek symlink saat plan tidak cukup: ulangi tepat sebelum tulis/hapus/backup + realpath + tolak nlink>1; rollback wajib melaporkan kegagalan (jangan telan).
- Nama device Windows (NUL/COM1) di Node modern tidak menulis ke device tapi membuat file yatim; tolak di validasi path.
- Test pihak lain memakai kode/flag yang kamu ubah (updateIntegration, i18n-codes): grep dan sesuaikan, laporkan.
- Migrasi yang menyalin rahasia harus membersihkan sumbernya (scrubSecrets) — jangan tinggalkan plain text di file lama.
- Aset web update = overlay per file (config.webOverlay), bukan pengganti root; permintaan aset berekstensi yang hilang = 404, bukan index.html.
- Cache hasil cek harus terikat endpoint; jalur baca (check) jangan melempar untuk kondisi yang cuma layak ditolak di jalur tulis (hardlink).
- Field kode yang harus dihapus UI pakai null, bukan undefined (JSON membuang undefined).
- Kegagalan senyap yang hanya masuk log tidak terlihat pembeli: pisahkan status "tidak ada" vs "ada tapi tidak terbaca" di API (mis. API_KEY_UNREADABLE), jangan hapus data yang mungkin terbaca nanti. Pesan log = Inggris.
- [studio-chat](studio-chat.md) — chat BE (S3): ChatRegistry, chatService, runner.chat
