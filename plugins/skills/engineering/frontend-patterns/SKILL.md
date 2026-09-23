---
name: frontend-patterns
description: Aturan coding dan arsitektur frontend profesional. Mencakup struktur, komponen & design system, state management, data fetching, form, aksesibilitas WCAG 2.2 AA, performa Core Web Vitals, keamanan (XSS/CSP), i18n, error monitoring, dan testing. Pakai saat menulis, mengubah, atau mendesain UI/komponen/halaman web (React/Next.js/Vue/Svelte).
---

# Frontend Patterns

Isinya **keputusan default** untuk hal yang belum diatur project, bukan tutorial. Konvensi di codebase yang ada **selalu menang**. Jangan menambahkan library atau pola dari sini ke project yang belum memakainya, kecuali spec memintanya: pola yang tidak konsisten dengan sekitarnya lebih mahal daripada pola yang kurang ideal.

## 1. Struktur

```
src/
├── app/ atau pages/     # routing tipis: menyusun komponen fitur
├── features/<fitur>/    # components/, hooks/, api.ts, schemas.ts (zod), types.ts
├── components/ui/       # komponen generik (Button, Input, Modal): design system
├── lib/                 # api client, util, config
└── styles/              # design token, global CSS
```

Arah dependency: `app` → `features` → `components/ui` / `lib`. Komponen generik tidak bergantung ke fitur, dan satu fitur tidak meng-import isi internal fitur lain.

## 2. Komponen

- Pakai design token (warna, spacing, radius, tipografi, shadow); jangan hardcode hex atau px.
- Logika di hook, tampilan di komponen. Komponen yang mengambil data, mengatur form, dan menggambar tabel sekaligus dipecah jadi container + presentational. Komponen di atas ±200 baris dipecah.
- Komponen memanggil API lewat modul fitur (`wishlistApi.list()`), bukan `fetch()` langsung.
- Props kecil dan spesifik (jangan mengoper seluruh objek demi dua field). Varian lewat composition (`<Card><Card.Footer/></Card>`), bukan tumpukan prop boolean. Prop drilling lebih dari 2 level → composition atau context.
- **Rem YAGNI:** komponen generik dibuat setelah ada **≥2 pemakaian nyata**. Project memakai Storybook → komponen UI generik didokumentasikan di sana.
- Setiap tampilan data menangani loading (skeleton), empty (dengan ajakan aksi), error (pesan manusiawi + retry), success, dan disabled/submitting, serta teks panjang, data banyak, dan gambar yang gagal dimuat.

## 3. State

| Jenis state | Tempat |
|---|---|
| Server state (data API) | TanStack Query / SWR / RTK Query, **tidak disalin ke global store** |
| URL state (filter, page, tab) | Query params, supaya bisa di-share dan tombol back berfungsi |
| Form state | Library form |
| UI lokal | `useState` / `useReducer` |
| Global client (tema, sesi, keranjang) | Zustand/Context, secukupnya |

Nilai turunan dihitung, bukan disimpan. Satu sumber kebenaran untuk setiap data.

## 4. Data fetching

- Satu API client terpusat: base URL, auth, timeout, parsing error RFC 9457, dan refresh token.
- Tipe dibuat dari skema OpenAPI atau divalidasi zod di boundary.
- Error: 401 → login · 403 → halaman "tidak berhak" · 404 → halaman not found · 422 → error per field · 5xx → pesan umum + retry.
- Pencarian di-debounce, dan request yang sudah tidak relevan dibatalkan (AbortController). Optimistic update hanya untuk aksi yang jarang gagal, dengan rollback kalau gagal.
- Next.js/SSR: ambil data di server kalau memungkinkan; data server-only tidak boleh bocor ke client component.

## 5. Form

React Hook Form + zod (atau setara), dengan schema yang sebisa mungkin dipakai bersama backend. Server tetap sumber kebenaran, dan errornya ditampilkan per field. Label terlihat (bukan hanya placeholder), fokus pindah ke field error pertama saat submit, tombol submit di-disable saat submitting, aksi destruktif dikonfirmasi, dan `type`/`autocomplete` input benar (`email`, `tel`, `one-time-code`, `current-password`).

## 6. Responsif

Mobile-first, diuji mulai dari lebar **360px** tanpa scroll horizontal. Teks pakai `rem`. Dark mode dan `prefers-reduced-motion` kalau design system mendukung.

## 7. Aksesibilitas (WCAG 2.2 AA)

Yang paling sering terlewat: input tanpa `label` dan icon button tanpa `aria-label` · aksi pakai `button`, navigasi pakai `a` · fokus terlihat dan **tidak tertutup** header sticky · modal menjebak fokus, bisa ditutup dengan Esc, lalu fokus kembali ke pemicunya · kontras teks 4.5:1 (teks besar dan komponen UI 3:1) · target sentuh minimal 24×24px · informasi tidak hanya lewat warna · perubahan dinamis (toast, error, hasil pencarian) diumumkan lewat `aria-live`. ARIA hanya kalau HTML native tidak cukup. Cek dengan axe dan navigasi keyboard.

## 8. Performa

Target p75: LCP < 2.5 s, INP < 200 ms, CLS < 0.1. Code splitting per route dan lazy-load komponen berat (chart, editor, map) · gambar modern dengan `width`/`height`, `loading="lazy"` di bawah fold, prioritas tinggi untuk gambar LCP · font `swap` + preload font utama · cek dampak bundle sebelum menambah dependency · `memo`/`useMemo`/`useCallback` hanya untuk masalah re-render yang **terukur** · list di atas ±100 item di-virtualize.

## 9. Keamanan

HTML dari user disanitasi (DOMPurify); hindari `dangerouslySetInnerHTML`/`v-html` · tidak ada secret di kode client, hanya env publik (`NEXT_PUBLIC_*`, `VITE_*`) · token sesi di cookie `HttpOnly; Secure; SameSite`, bukan localStorage · Content Security Policy tanpa inline script · URL divalidasi sebelum dipakai di `href`/redirect (cegah `javascript:` dan open redirect) · authorization di UI hanya untuk kenyamanan, keamanan sebenarnya ada di server.

## 10. i18n, analytics & privasi

Teks yang dilihat user dipusatkan di file terjemahan kalau project multi-bahasa · tanggal, angka, dan uang diformat lewat `Intl` (misalnya `Rp 150.000`) · nama event analytics konsisten (`checkout_started`), tanpa PII, dan menghormati consent (UU PDP/GDPR).

## 11. Error & monitoring

Error boundary di level route/fitur · error dikirim ke monitoring (Sentry, dll.) dengan route, release, dan user ID yang aman, plus source map · pesan error untuk user manusiawi dan bisa ditindaklanjuti.

## 12. Testing

Testing trophy: fokus terbesar di component/integration test dengan Testing Library (query berdasarkan role/label, bukan class/test-id); unit test untuk util, hook, dan logika murni; E2E (Playwright) untuk alur kritis. Mock API memakai MSW, bukan mock internal fungsi fetch. Uji perilaku, bukan detail implementasi.
