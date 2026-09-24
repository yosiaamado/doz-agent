# Studi Kasus Visual

Bahan referensi untuk `ui-design-taste`. Angka warna dan tipografi di bawah diambil langsung dari CSS situsnya (inspeksi September 2026), bukan dikira-kira.

## Bagian 1: Lima dashboard admin

### A. Dashboard template padat (gaya "Architect")

Sidebar terang berkelompok, header hijau, banyak widget kecil, tab, tabel dengan sparkline.

- **Ditiru:** pengelompokan sidebar berlabel (`MENU`, `UI COMPONENTS`, `FORMS`), sparkline di dalam baris tabel, badge status pill.
- **Dihindari:** terlalu banyak widget setara di satu layar sehingga tidak ada yang menonjol; teks 11–12px di mana-mana; warna badge yang saling bersaing (kuning, hijau, merah, biru dalam satu kolom dengan saturasi penuh).
- **Pelajaran:** kepadatan tinggi boleh untuk alat kerja harian, tapi tetap harus ada **satu** elemen yang paling besar di layar.

### B. Dashboard SaaS lapang (gaya "Consult")

Kartu besar radius ±20px, satu kartu ungu dominan berisi angka utama, kalender di kanan, daftar wawancara.

- **Ditiru:** satu kartu "pahlawan" berwarna aksen penuh untuk angka terpenting, sementara kartu lain putih dan tenang. Ini cara paling murah membuat hierarki di dashboard.
- **Ditiru:** ruang kosong yang berani, dan daftar jadwal dengan avatar + waktu di kanan.
- **Dihindari:** CTA "Upgrade" berilustrasi besar yang memakan sepertiga sidebar.
- **Palet acuan:** ungu `#5B4CC4` (aksen), mint `#7DE0E6` dan coral `#F4846B` (pendukung, porsi kecil), latar `#FFFFFF` dengan halaman abu sangat terang.

### C. Dashboard gradien (gaya "Purple")

Tiga kartu KPI gradien (pink, biru, tosca) berjejer, chart batang warna-warni, donat tiga warna.

- **Ini contoh anti-pattern utama.** Gradien di semua kartu membuat tidak ada yang lebih penting, dan teks putih di atas gradien terang sering gagal kontras.
- **Kalau ingin memakai gradien:** satu kartu saja, atau untuk hero. Sisanya putih dengan delta berwarna.
- **Yang layak ditiru:** ikon kecil di pojok kanan kartu sebagai penanda kategori, dan keterangan perubahan ("Increased by 60%") tepat di bawah angka.

### D. Dashboard bertema (gaya "EduAdmin")

Sidebar navy gelap, banner sambutan biru dengan ilustrasi, kartu kursus dengan chip kategori berwarna dan progress bar.

- **Ditiru:** banner sambutan personal di atas ("Welcome, Jhone") memberi rasa produk, bukan panel mentah. Progress bar tipis dengan persentase di atasnya mudah dipindai.
- **Dihindari:** chip kategori dengan warna solid berbeda-beda (biru, oranye, merah, cyan) yang tidak punya arti sistematis; notifikasi berwarna-warni yang menarik perhatian lebih besar dari konten utamanya.
- **Pelajaran:** sidebar gelap + konten terang adalah kombinasi aman dan terlihat rapi, asal warna aksen di konten tetap satu.

### E. Dashboard data-first (gaya "Adminator")

Netral hampir seluruhnya, label kecil huruf kapital, angka besar dengan huruf berjarak sama, delta berikut baris pembanding, daftar wilayah dengan bar tipis.

- **Ini acuan terbaik untuk dashboard internal.** Hampir tanpa warna, tapi paling cepat dibaca.
- **Ditiru semuanya:**
  - Kalimat ringkasan di atas: "Total visits +10% week over week… Two new regions came online overnight." Satu paragraf manusiawi mengalahkan empat kartu tanpa konteks.
  - Anatomi KPI: label → angka → delta → baris pembanding (`up from 1.12M last week`).
  - Label seksi kecil (`GEOGRAPHY`, `PERFORMANCE`, `PERSONAL`) sebagai pembatas, bukan garis tebal.
  - Angka dengan `tabular-nums` sehingga kolom terlihat lurus.
  - Warna hanya muncul pada delta dan bar progres.

## Bagian 2: Tiga situs Indonesia

### Gojek — sistem yang matang

- **Tipografi:** satu keluarga (Maison Neue) dengan varian Book/Demi/Bold/Extended. Body 16px, `line-height` 24px, judul 24–26px. Hierarki dibangun dari berat huruf, bukan dari banyak ukuran.
- **Warna:** hijau `#00AA13` sebagai aksen tunggal, ink gelap `#101820` dan `#27455C` untuk teks/latar, abu `#696969` untuk teks sekunder, putih sebagai kanvas utama. Warna pastel (pink, oranye, hijau muda) hanya muncul sebagai aksen kecil di ilustrasi.
- **Bentuk:** radius ekstrem dipakai sengaja — `2px` untuk elemen kecil, tapi `40px`, `64px`, `96px` untuk kartu dan panel besar. Kontras radius ini yang membuatnya terasa ramah tapi tegas.
- **Bayangan:** halus dan berwarna (`rgba(16,24,32,.2) 0 0 10px`, dan glow berwarna `rgb(208,180,212) 0 0 32px 10px` di kartu tertentu) — dipakai sebagai aksen, bukan pemisah.
- **Diambil untuk dashboard:** satu aksen kuat, tipografi satu keluarga, dan keberanian memakai radius besar secara konsisten pada kartu.

### Toko Kopi Tuku — karakter dari palet dan tipografi

- **Warna:** krem `#F3EAD2`, tan `#C0AF90`, oranye `#EA9330`, biru-abu `#5D84A3`, cokelat `#B76545`. Palet hangat, rendah saturasi, terasa seperti kemasan produk.
- **Bentuk:** `border-radius: 0` di seluruh situs, **tanpa bayangan sama sekali**. Flat, editorial, seperti poster cetak.
- **Tipografi:** font display khusus + font tulisan tangan untuk aksen. Ukuran kecil (10–16px) untuk isi, besar untuk judul.
- **Pelajaran:** karakter tidak datang dari efek, tapi dari **palet yang konsisten + tipografi berkarakter**. Sudut siku dan tanpa bayangan justru terasa lebih mahal daripada kartu mengambang.
- **Kapan dipakai:** produk bermerek kuat, landing page, atau halaman publik. Untuk dashboard, ambil paletnya saja, jangan radius nol-nya pada kontrol interaktif.

### Good Day "Hidup Banyak Rasa" — kampanye satu warna

- **Warna:** merah `#E1241C` di atas putih, teks ink `#212529`. Praktis dua warna saja.
- **Tipografi:** Poppins, berat 400 dan 700 saja.
- **Motion:** transisi `0.2s` konsisten di seluruh elemen interaktif.
- **Pelajaran:** satu warna berani + satu font + transisi seragam sudah cukup untuk terasa rapi. Kerumitan bukan syarat.

## Bagian 3: Ringkasan yang bisa langsung dipakai

| Kebutuhan | Arah visual |
|---|---|
| Dashboard internal, data padat | Gaya E: netral, label kecil, angka besar tabular, warna hanya di delta |
| Dashboard produk untuk pelanggan | Gaya B + Gojek: satu kartu aksen dominan, radius besar konsisten, banyak ruang |
| Produk bermerek / halaman publik | Tuku: palet hangat konsisten, tipografi display, efek minimal |
| Kampanye atau halaman fokus tunggal | Good Day: dua warna, dua berat huruf, satu ajakan aksi |

**Tiga hal yang muncul di semua contoh bagus, dan tidak ada di contoh yang lemah:**

1. Aksen tunggal yang dipakai disiplin.
2. Satu keluarga font dengan sedikit berat, bukan banyak ukuran.
3. Angka selalu ditemani konteks: periode, pembanding, atau target.
