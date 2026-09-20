---
name: frontend-patterns
description: Aturan coding dan arsitektur frontend profesional. Mencakup struktur, komponen & design system, state management, data fetching, form, aksesibilitas WCAG 2.2 AA, performa Core Web Vitals, keamanan (XSS/CSP), i18n, error monitoring, dan testing. Pakai saat menulis, mengubah, atau mendesain UI/komponen/halaman web (React/Next.js/Vue/Svelte).
---

# Frontend Patterns

Konvensi di codebase yang ada **selalu menang**. Pakai aturan ini kalau project belum punya aturan sendiri.

## 1. Struktur

```
src/
├── app/ atau pages/        # routing (tipis: susun komponen fitur)
├── features/
│   └── checkout/
│       ├── components/     # komponen khusus fitur ini
│       ├── hooks/          # useCheckout, dll.
│       ├── api.ts          # pemanggilan API fitur ini
│       ├── schemas.ts      # validasi (zod)
│       └── types.ts
├── components/ui/          # komponen generik (Button, Input, Modal): design system
├── lib/                    # api client, util, config
└── styles/                 # design token, global CSS
```

- Arah dependency: `app` → `features` → `components/ui` / `lib`. Komponen generik tidak boleh bergantung pada fitur, dan satu fitur tidak boleh meng-import isi internal fitur lain.
- Satu komponen per file, dengan nama PascalCase. Hook diawali `use`.

## 2. Komponen & design system

- **Pakai design system/token** yang ada: warna, spacing, radius, tipografi, shadow. Jangan hardcode hex atau px acak.
- Pisahkan logika (hook) dari tampilan (komponen presentational).
- Props diberi tipe eksplisit, dengan API yang kecil dan konsisten. Hindari prop drilling lebih dari 2 level (pakai composition atau context).
- Komponen di atas ±200 baris dipecah.
- `key` di list pakai ID yang stabil, bukan index.
- **Tangani semua state UI:** loading (skeleton), empty (ada ajakan aksi), error (pesan manusiawi + retry), success, dan disabled/submitting. Perhatikan juga teks panjang, data banyak, dan gambar yang gagal dimuat.
- Kalau project memakai Storybook, dokumentasikan komponen UI generik di sana.

### Clean code & SOLID untuk komponen

- **Satu tanggung jawab per komponen.** Komponen yang mengambil data, mengatur form, dan menggambar tabel sekaligus dipecah: container (data) + presentational (tampilan).
- **Logika di hook, tampilan di komponen.** Komponen yang isinya penuh `useEffect` dan transformasi data berarti hook-nya belum dipisah. Hook juga yang membuat logikanya bisa di-test tanpa render.
- **Props kecil dan spesifik.** Jangan mengoper seluruh objek hanya karena butuh dua field. Varian dibuat lewat composition (`<Card><Card.Footer/></Card>`), bukan tumpukan prop boolean (`isCompact`, `isInline`, `isBordered`).
- **Bergantung ke abstraksi, bukan detail.** Komponen memanggil `wishlistApi.list()`, bukan `fetch()` langsung. Ganti endpoint atau tambah header cukup di satu tempat.
- **Rem YAGNI:** komponen "generik" dibuat setelah ada **≥2 pemakaian nyata**. Sebelum itu, komponen khusus fitur lebih murah dan lebih mudah diubah.

## 3. State management

| Jenis state | Tempat |
|---|---|
| Server state (data API) | TanStack Query / SWR / RTK Query. **Jangan disalin ke global store** |
| URL state (filter, page, tab) | Query params, supaya bisa di-share dan tombol back berfungsi |
| Form state | Library form |
| UI lokal | `useState` / `useReducer` |
| Global client (tema, sesi, keranjang) | Zustand/Context, secukupnya |

Nilai turunan dihitung, bukan disimpan di state. Satu sumber kebenaran untuk setiap data.

## 4. Data fetching

- Satu **API client terpusat**: base URL, auth, timeout, parsing error RFC 9457, dan refresh token.
- Tipe dibuat dari skema OpenAPI atau divalidasi dengan zod di boundary. Jangan percaya bentuk response begitu saja.
- **Penanganan error:**
  - 401: arahkan ke login.
  - 403: tampilkan halaman "tidak berhak".
  - 404: tampilkan halaman not found.
  - 422: tampilkan error per field.
  - 5xx: tampilkan pesan umum + retry.
- Request pencarian di-debounce, dan request yang sudah tidak relevan dibatalkan (AbortController).
- **Optimistic update** hanya untuk aksi yang jarang gagal, dan harus ada rollback kalau gagal.
- Next.js/SSR: ambil data di server kalau memungkinkan. Jangan bocorkan data server-only ke client component.

## 5. Form

- Pakai library form (React Hook Form + zod, atau yang setara). Schema validasi sebisa mungkin dipakai bersama dengan backend.
- Validasi di client untuk UX, tapi **server tetap sumber kebenaran**. Tampilkan error dari server per field.
- Label terlihat (bukan hanya placeholder), error di bawah field, dan fokus pindah ke field error pertama saat submit.
- Tombol submit di-disable saat submitting (cegah double submit). Konfirmasi dulu untuk aksi destruktif.
- Pakai tipe input dan `autocomplete` yang benar (`email`, `tel`, `one-time-code`, `current-password`).

## 6. Styling & responsif

- Mobile-first, breakpoint konsisten, diuji mulai dari lebar **360px**, tanpa scroll horizontal.
- Pakai unit relatif untuk teks (`rem`) supaya mengikuti pengaturan zoom user.
- Dukung dark mode dan `prefers-reduced-motion` kalau design system mendukung.

## 7. Aksesibilitas (WCAG 2.2 level AA)

- **HTML semantik:** `button` untuk aksi, `a` untuk navigasi, heading berurutan, landmark (`header`, `nav`, `main`, `footer`), dan `lang` di `<html>`.
- **Label & nama:** setiap input punya `label`, icon button punya `aria-label`, dan gambar punya `alt` (kosong `alt=""` untuk gambar dekoratif).
- **Keyboard:** semua bisa dioperasikan dengan keyboard, urutan fokus logis, dan fokus terlihat serta **tidak tertutup** header sticky atau elemen lain.
- **Modal/dialog:** fokus terjebak di dalam, bisa ditutup dengan Esc, dan fokus kembali ke pemicunya.
- **Kontras:** teks minimal 4.5:1 (teks besar 3:1), komponen UI dan ikon minimal 3:1.
- **Target sentuh** minimal 24×24px (disarankan 44×44px untuk mobile).
- **Jangan mengandalkan warna saja** untuk menyampaikan informasi (error, status).
- **Perubahan dinamis** (toast, error, hasil pencarian) diumumkan lewat `aria-live`.
- Pakai ARIA hanya kalau HTML native tidak cukup. ARIA yang salah lebih buruk daripada tidak ada ARIA sama sekali.
- Cek dengan axe/Lighthouse dan navigasi keyboard manual.

## 8. Performa (Core Web Vitals)

Target di persentil ke-75 user:
- **LCP** < 2.5s
- **INP** < 200ms
- **CLS** < 0.1

Caranya:
- Code splitting per route, dan lazy-load komponen berat (chart, editor, map).
- **Gambar:** format modern (AVIF/WebP), `srcset`/ukuran pas, `width`/`height` atau `aspect-ratio`, `loading="lazy"` untuk gambar di bawah fold, dan prioritas tinggi untuk gambar LCP.
- **Font:** `font-display: swap`, subset, dan preload untuk font utama.
- **Performance budget:** perhatikan ukuran bundle JS. Cek dampak sebelum menambah dependency (bundlephobia).
- Hindari pekerjaan berat di main thread. Pecah long task, dan debounce/throttle event handler.
- `memo`/`useMemo`/`useCallback` hanya dipakai kalau ada masalah re-render yang **terukur**.
- List panjang (> ±100 item) di-virtualize.

## 9. Keamanan

- Jangan render HTML dari user tanpa sanitasi (DOMPurify). Hindari `dangerouslySetInnerHTML`/`v-html`.
- **Tidak ada secret di kode client.** Semua yang ada di bundle bisa dibaca publik, jadi hanya env publik (`NEXT_PUBLIC_*`, `VITE_*`) yang boleh.
- Token sesi disimpan di cookie `HttpOnly; Secure; SameSite`, bukan localStorage.
- Terapkan **Content Security Policy** dan hindari inline script.
- Validasi URL sebelum dipakai di `href`/redirect (cegah `javascript:` dan open redirect). Link eksternal diberi `rel="noopener noreferrer"`.
- Authorization di UI hanya untuk kenyamanan. **Keamanan sebenarnya ada di server.**

## 10. i18n, analytics & privasi

- Semua teks yang dilihat user dipusatkan di file terjemahan kalau project multi-bahasa.
- Format tanggal, angka, dan mata uang memakai `Intl` sesuai locale (misalnya `Rp 150.000`).
- Event analytics diberi nama yang konsisten (`checkout_started`). Jangan kirim PII ke analytics, dan hormati consent sesuai UU PDP/GDPR.

## 11. Error handling & monitoring

- Pasang **error boundary** di level route/fitur supaya satu komponen yang error tidak membuat seluruh halaman putih.
- Error dikirim ke monitoring (Sentry, dll.) beserta konteksnya (route, release, user ID yang aman), dan source map di-upload.
- Pesan error untuk user harus manusiawi dan bisa ditindaklanjuti, bukan teks error teknis mentah.

## 12. Testing

Ikuti **testing trophy:** fokus terbesar di integration/component test.

| Level | Tool | Untuk |
|---|---|---|
| Static | TypeScript, ESLint | Kesalahan tipe dan pola |
| Unit | Vitest/Jest | Util, hook, logika murni |
| Component/integration | Testing Library | Perilaku dari sudut pandang user: query berdasarkan role/label, bukan class/test-id |
| E2E | Playwright | Alur kritis: login, checkout, form utama |
| Visual/a11y | Playwright screenshot, axe | Regresi tampilan & aksesibilitas (kalau ada setup-nya) |

- Mock API memakai MSW, bukan mock internal fungsi fetch.
- Uji perilaku, bukan detail implementasi (state internal, nama class).
