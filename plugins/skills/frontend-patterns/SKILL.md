---
name: frontend-patterns
description: Aturan coding dan arsitektur frontend (struktur komponen, state management, data fetching, form, styling, aksesibilitas, performa, testing). Pakai saat menulis, mengubah, atau mendesain UI/komponen/halaman web, terutama React/Next.js/Vue, dan kalau project belum punya konvensi sendiri.
---

# Frontend Patterns

Konvensi di codebase yang ada **selalu menang**. Pakai aturan ini kalau project belum punya aturan sendiri.

## 1. Struktur

```
src/
├── app/ atau pages/        # routing
├── features/
│   └── checkout/
│       ├── components/     # komponen khusus fitur ini
│       ├── hooks/          # useCheckout, dll.
│       ├── api.ts          # pemanggilan API fitur ini
│       └── types.ts
├── components/ui/          # komponen generik (Button, Input, Modal)
├── lib/                    # api client, util, config
└── styles/
```

- Komponen generik tidak boleh bergantung pada fitur.
- Satu komponen per file, nama file dan komponen PascalCase.

## 2. Komponen

- Pisahkan logika (hook) dari tampilan (komponen).
- Props diberi tipe eksplisit. Hindari prop drilling lebih dari 2 level (pakai composition atau context).
- Komponen di atas ±200 baris dipecah.
- `key` di list pakai ID yang stabil, bukan index.
- Tangani semua state: **loading (skeleton), empty, error (ada tombol retry), success.**

## 3. State management

- **Server state** (data dari API) pakai TanStack Query / SWR / RTK Query. Jangan disalin ke global store.
- **UI state lokal** pakai `useState`/`useReducer`.
- **Global client state** (tema, sesi, keranjang) pakai Zustand/Context, dan secukupnya.
- **URL state** (filter, pagination, tab) disimpan di query params supaya bisa di-share.
- Nilai turunan dihitung, bukan disimpan di state.

## 4. Data fetching

- Satu API client terpusat (base URL, auth header, penanganan error, refresh token).
- Tipe response dibuat dari skema (OpenAPI/zod) kalau tersedia.
- Tangani 401 (arahkan ke login), 403, 404, dan 5xx secara konsisten.
- Request pencarian di-debounce. Request yang sudah tidak relevan dibatalkan.

## 5. Form

- Pakai library form (React Hook Form + zod, atau yang setara).
- Validasi di client untuk UX, tapi tetap anggap server sebagai sumber kebenaran.
- Pesan error tampil di bawah field. Tombol submit di-disable saat submitting, supaya tidak double submit.

## 6. Styling

- Ikuti design token (warna, spacing, radius, font). Jangan hardcode hex acak.
- Mobile-first, breakpoint konsisten, dan diuji mulai dari lebar 360px.
- Dukung dark mode kalau design system-nya mendukung.

## 7. Aksesibilitas

- Pakai elemen semantik: `button` untuk aksi, `a` untuk navigasi, heading berurutan.
- Setiap input punya `label`. Gambar punya `alt`. Icon button punya `aria-label`.
- Semua bisa dioperasikan dengan keyboard, fokus terlihat, modal menjebak fokus dan bisa ditutup dengan Esc.
- Kontras warna minimal 4.5:1 untuk teks.

## 8. Performa

- Route dan komponen berat di-lazy-load.
- Gambar dioptimasi (format modern, ukuran pas, `loading="lazy"`), dengan dimensi tetap supaya tidak ada layout shift.
- `memo`/`useMemo`/`useCallback` hanya dipakai kalau ada masalah re-render yang terukur.
- List panjang di-virtualize.
- Pantau Core Web Vitals (LCP < 2.5s, INP < 200ms, CLS < 0.1).

## 9. Keamanan

- Jangan render HTML dari user tanpa sanitasi (DOMPurify).
- Tidak ada secret di kode client. Env publik saja yang boleh (`NEXT_PUBLIC_*`, `VITE_*`).
- Token sesi disimpan di cookie HttpOnly, bukan localStorage.

## 10. Testing

- Unit test untuk util dan hook.
- Component test (Testing Library) yang menguji perilaku dari sudut pandang user, bukan detail implementasi.
- E2E (Playwright) untuk alur kritis: login, checkout, dan form utama.
