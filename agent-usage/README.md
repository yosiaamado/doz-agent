# agent-usage

Catatan pemakaian agent per workflow, sebagai pembanding antar versi doz-agent. Folder ini tidak ikut ter-install ke project (plugin hanya berisi `plugins/`).

- Nama file: `YYYY-MM-DD.md` (tanggal workflow). Lebih dari satu di hari yang sama → `YYYY-MM-DD-2.md`.
- Isi: tabel konteks (workflow, cakupan, versi doz-agent saat dijalankan), tabel token per agent dari output `token-audit` apa adanya, tabel **Metrik pembanding** dengan baris yang sama seperti file sebelumnya, lalu catatan singkat.
- Perubahan agent yang dipicu audit dicatat di `CHANGELOG.md` dan merujuk ke file di sini.
- Membandingkan: bandingkan Metrik pembanding antar file, dengan memperhatikan kolom versi dan cakupan (jumlah permintaan/slice, stack). Workflow dengan cakupan berbeda jauh tidak bisa dibandingkan langsung; pakai $ per slice.
