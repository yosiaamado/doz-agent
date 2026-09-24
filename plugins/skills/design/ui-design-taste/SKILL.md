---
name: ui-design-taste
description: Selera desain visual untuk UI produk dan dashboard admin — bukan aturan kode. Mengatur hierarki, spacing 8pt, skala tipografi, palet 1 aksen, kartu & elevasi, anatomi KPI/chart/tabel, empty & loading state, motion, dan daftar anti-pattern. Pakai saat membangun atau memperbaiki tampilan: halaman baru, dashboard, landing, komponen, "bikin bagus", "kurang rapi", "biar nggak template banget", atau saat memilih warna, ukuran, dan jarak.
---

# UI Design Taste

Aturan kode ada di `frontend-patterns`. File ini soal **rasa**: kenapa satu layar terlihat mahal dan layar lain terlihat seperti template gratisan, padahal isinya sama.

**Satu kalimat yang memandu semuanya:** desain yang bagus itu bukan yang paling banyak hiasannya, tapi yang paling cepat dibaca. Hierarki dibangun dari **ruang, ukuran, dan berat huruf** — bukan dari garis, kotak, bayangan, dan warna.

## 1. Lima keputusan yang menentukan hasil

Sebelum menulis komponen, kunci lima hal ini. Tulis di komentar atau file token, jangan ditebak per komponen.

| Keputusan | Default yang aman |
|---|---|
| **Skala spacing** | Kelipatan 4: `4 8 12 16 24 32 48 64`. Tidak ada angka di luar skala |
| **Skala radius** | `6px` kontrol kecil · `12px` kartu · `999px` pill/avatar. Satu produk maksimal 3 nilai |
| **Palet** | 1 warna aksen + netral abu bertingkat + 3 semantik (success/warning/danger) |
| **Tipografi** | 1 keluarga font (maksimal 2), 3 berat: 400 / 500–600 / 700 |
| **Kepadatan** | Pilih: *comfortable* (baris tabel 48–56px) atau *compact* (36–40px). Konsisten seluruh app |

## 2. Layout & ruang

- **Ruang kosong itu fitur, bukan sisa.** Kalau layar terasa sesak, hapus elemen atau tambah jarak — jangan mengecilkan font.
- **Padding kartu 20–24px** di desktop, 16px di mobile. Kartu dengan padding 8px selalu terlihat murah.
- **Jarak antar-blok > jarak dalam blok.** Label dan angkanya berjarak 4px; kartu ke kartu 16–24px; seksi ke seksi 32–48px. Ini yang membuat mata tahu apa milik siapa tanpa garis pemisah.
- **Grid 12 kolom**, gutter 24px. Konten teks panjang dibatasi **60–75 karakter** per baris.
- **Satu halaman = satu tujuan.** Elemen paling penting mendapat posisi kiri-atas dan ukuran terbesar. Kalau semua menonjol, tidak ada yang menonjol.
- **Halaman panjang lebih baik daripada halaman padat.** Scroll itu murah, kebingungan itu mahal.

## 3. Tipografi

Skala yang bisa langsung dipakai (rasio ±1.25):

| Peran | Ukuran | Berat | Catatan |
|---|---|---|---|
| Display / angka besar | 32–40px | 600–700 | Untuk satu angka utama saja |
| Judul halaman | 24–28px | 600 | |
| Judul kartu / seksi | 16–18px | 600 | |
| Body | 14–16px | 400 | `line-height` 1.5 |
| Label & meta | 12–13px | 500 | Warna abu, boleh `letter-spacing: .04em` + UPPERCASE untuk *eyebrow* |

- **Angka pakai `font-variant-numeric: tabular-nums`.** Tanpa ini, kolom angka di tabel dan KPI terlihat goyang.
- **Jangan pakai lebih dari 3 ukuran font dalam satu kartu.** Biasanya cukup: label kecil, angka besar, keterangan kecil.
- **Berat, bukan ukuran, untuk penekanan halus.** Naikkan 400 → 600 sebelum memperbesar ukuran.
- Teks panjang rata kiri. Rata tengah hanya untuk 1–2 baris (judul hero, empty state).
- Hindari teks abu di atas abu: body minimal `#475569`-ish di latar terang.

## 4. Warna

**Formula 60-30-10:** 60% netral (latar & permukaan), 30% teks, 10% aksen. Aksen dipakai untuk **aksi dan penanda**, bukan untuk dekorasi.

- **Netral berlapis, bukan garis di mana-mana.** Latar halaman `#F7F8FA`, kartu putih, border `#E5E7EB` 1px. Kombinasi ini jauh lebih bersih daripada kartu putih di latar putih yang dipisah bayangan tebal.
- **Satu aksen.** Kalau butuh membedakan banyak kategori (chart, tag), pakai turunan aksen + netral, bukan pelangi.
- **Semantik konsisten:** hijau = naik/berhasil, merah = turun/gagal, kuning = perlu perhatian, biru/aksen = netral-informasi. Jangan pakai merah hanya karena cantik.
- **Gradien secukupnya.** Satu area (hero atau satu kartu unggulan), bukan semua kartu KPI. Empat kartu gradien berwarna-warni adalah tanda template.
- **Warna tidak boleh jadi satu-satunya pembawa makna.** Selalu ada ikon, tanda, atau teks pendamping.
- **Kontras:** teks 4.5:1, elemen UI dan ikon 3:1. Cek sebelum menyerahkan pekerjaan.
- **Dark mode bukan warna di-invert.** Latar `#0B0F14`–`#111827`, permukaan dinaikkan dengan terang (bukan bayangan), dan warna aksen diturunkan saturasinya supaya tidak menyilaukan.

## 5. Permukaan, border & elevasi

- **Default: border 1px + bayangan sangat halus** (`0 1px 2px rgba(16,24,40,.06)`). Bayangan besar dan gelap membuat UI terlihat tua.
- Naikkan elevasi hanya untuk elemen yang benar-benar mengambang: dropdown, popover, modal, toast.
- **Jangan menumpuk kotak.** Kartu di dalam kartu di dalam panel = tiga border sekaligus. Pisahkan dengan jarak atau garis tipis.
- Radius konsisten. Tombol 6–8px sementara kartunya 20px terlihat tidak sengaja.
- **Batas tetap terlihat saat hover:** ganti latar ke abu paling terang, jangan menggeser layout.

## 6. Dashboard: anatomi yang benar

### Kartu KPI

Urutannya **label → angka → perubahan → konteks**:

```
TOTAL VISITS              ← label 12px, abu, uppercase opsional
1.24M                     ← angka 32-36px, 600, tabular-nums
↗ +10%  vs minggu lalu    ← delta berwarna semantik + pembanding
```

- **Angka tanpa pembanding itu tidak berarti.** Selalu sertakan periode atau target.
- Satu ikon kecil saja, kalau memang membantu. Ikon besar berwarna di setiap kartu = ruang terbuang.
- Empat KPI sudah banyak. Kalau ada delapan, berarti belum ada yang memutuskan mana yang penting.

### Chart

- **Hapus yang tidak menjelaskan:** gridline tebal, sumbu ganda, bayangan, efek 3D, dan legenda yang jauh dari datanya.
- Label seri diletakkan **langsung di dekat garis/bar terakhir** kalau memungkinkan.
- Sumbu Y mulai dari nol untuk bar chart. Format angka disingkat (`1.2M`, `Rp 4,1 jt`).
- Maksimal 5 seri dalam satu chart. Lebih dari itu, pecah atau pakai small multiples.
- Tooltip menampilkan nilai persis + periode, dan mengikuti kursor tanpa menutupi datanya.
- Sparkline untuk tren di dalam tabel, chart penuh untuk analisis.

### Tabel

- Teks rata kiri, **angka rata kanan dengan tabular-nums**, header rata mengikuti kolomnya.
- Header sticky, dan kolom identitas (nama/ID) sticky kalau tabelnya lebar.
- Zebra striping opsional; garis horizontal tipis biasanya cukup. **Hindari garis vertikal.**
- Status pakai *badge* pill dengan latar lembut (`bg` 10% aksen, teks warna penuh), bukan blok warna pekat.
- Aksi baris: maksimal 2 tombol terlihat, sisanya di menu `⋯`. Aksi destruktif tidak boleh bersebelahan dengan aksi yang sering dipakai.
- Sediakan jumlah data, filter yang terlihat aktif, dan pagination yang menyebutkan rentang (`1–20 dari 134`).

### Navigasi

- Sidebar dikelompokkan dengan label kecil (`WORKSPACE`, `COMPONENTS`), item aktif ditandai latar lembut + teks aksen, bukan hanya warna teks.
- Maksimal 7±2 item per kelompok. Lebih dari itu, kelompokkan atau sembunyikan di menu.
- Sediakan breadcrumb untuk halaman di dalam, dan pencarian global (`⌘K`) kalau datanya banyak.

## 7. State bukan tambahan, tapi bagian desain

- **Empty state** berisi satu kalimat penjelas + satu aksi utama. Jangan hanya "No data".
- **Loading** pakai skeleton yang meniru bentuk kontennya, bukan spinner di tengah layar. Aksi di dalam tombol: ubah label jadi status, jangan sembunyikan tombolnya.
- **Error** menjelaskan apa yang gagal dan apa yang bisa dilakukan, dengan tombol coba lagi.
- **Sukses** terlihat: toast singkat, atau perubahan di data yang langsung tampak. Aksi yang tidak memberi umpan balik terasa rusak.
- **First-run** berbeda dari empty biasa: tunjukkan contoh atau data dummy supaya user paham bentuk akhirnya.

## 8. Motion

- **120–200ms** untuk hover dan perubahan kecil, **200–300ms** untuk masuk/keluar panel. Lebih lambat dari itu terasa berat.
- `ease-out` untuk elemen yang masuk, `ease-in` untuk yang keluar.
- Animasikan `transform` dan `opacity` saja. Jangan animasikan `width`, `height`, atau `top`.
- Gerakan menjelaskan asal-usul: dropdown muncul dari pemicunya, modal naik sedikit, bukan meletus di tengah.
- Hormati `prefers-reduced-motion: reduce`.

## 9. Sentuhan yang bikin "mahal"

Ambil **satu atau dua** saja, jangan semuanya sekaligus:

- Satu elemen berkarakter: ilustrasi, foto produk, atau tipografi display di satu tempat (hero, empty state, kartu unggulan).
- Kalimat yang ditulis manusia: "Dua wilayah baru aktif semalam" jauh lebih hidup daripada "Data updated".
- Detail mikro: hover yang halus, fokus yang jelas, angka yang beranimasi naik sekali saat pertama muncul.
- Konsistensi ikon: satu set, satu ketebalan garis, satu ukuran per konteks (16/20/24).
- Format lokal yang benar: `Rp 1.250.000`, `12 Mei 2026`, `14.30`, dan bahasa yang konsisten (jangan campur "Submit" dengan "Simpan").

## 10. Anti-pattern (tanda template gratisan)

- Empat kartu KPI gradien warna-warni berjejer.
- Lima warna aksen tanpa alasan, tiap kartu beda warna.
- Bayangan tebal di semua elemen, plus border, plus latar abu.
- Ikon besar berwarna di setiap kartu tapi tidak menambah informasi.
- Judul kartu dan isi kartu berjarak sama dengan jarak antar-kartu.
- Tabel dengan garis vertikal penuh dan baris setinggi 28px.
- Chart dengan legenda 8 warna di pojok yang tidak bisa dicocokkan ke datanya.
- Teks abu muda di latar abu, "biar kalem".
- Tombol utama dan tombol sekunder sama-sama mencolok.
- Semua sudut membulat 20px termasuk input dan tabel.

## 11. Checklist sebelum menyerahkan tampilan

- [ ] Semua jarak ada di skala 4/8. Tidak ada `13px`, `17px`, `23px`.
- [ ] Maksimal 3 ukuran radius, dan konsisten antar komponen sejenis.
- [ ] Satu aksen. Warna lain hanya semantik atau netral.
- [ ] Angka memakai tabular-nums dan format lokal yang benar.
- [ ] Setiap angka penting punya pembanding atau konteks.
- [ ] Loading, empty, error, dan success sudah didesain, bukan default browser.
- [ ] Kontras teks ≥ 4.5:1, fokus keyboard terlihat jelas.
- [ ] Dicek di lebar 360px: tidak ada scroll horizontal, tabel bisa digeser atau berubah jadi kartu.
- [ ] Hover dan transisi ≤ 200ms, dan `prefers-reduced-motion` dihormati.
- [ ] Layar ini bisa dijelaskan dalam satu kalimat: "halaman ini untuk ___".

## 12. Referensi visual

Studi kasus lengkap (apa yang ditiru dan apa yang dihindari dari lima dashboard dan tiga situs Indonesia) ada di [references/case-studies.md](references/case-studies.md). Baca **kalau** sedang menentukan arah visual produk baru, memilih palet, atau diminta membuat sesuatu terasa berkarakter — bukan untuk perbaikan komponen kecil.
