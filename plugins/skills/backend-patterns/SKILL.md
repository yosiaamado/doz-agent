---
name: backend-patterns
description: Aturan coding dan arsitektur backend (struktur project, layering, API design REST, validasi, error handling, database & migration, caching, auth, logging, testing), dengan aturan tambahan per bahasa/framework (.NET/C#, dll.). Pakai saat menulis, mengubah, atau mendesain kode backend/API/service/database.
---

# Backend Patterns

Konvensi di codebase yang ada **selalu menang**. Pakai aturan ini kalau project belum punya aturan sendiri, atau kalau sedang membuat project baru.

## 0. Aturan per bahasa (baca dulu)

File ini berisi **aturan dasar** untuk semua bahasa. Setiap bahasa/framework punya file tambahan di folder `references/`. **Kalau aturan bahasa bertentangan dengan aturan dasar, aturan bahasa yang menang.**

Kenali bahasa project dari file yang ada, lalu baca file yang cocok **sebelum menulis kode**:

| Tanda di project | Baca file |
|---|---|
| `*.sln`, `*.slnx`, `*.csproj`, `Program.cs` | [references/dotnet.md](references/dotnet.md) |

Kalau bahasanya belum punya file referensi, pakai aturan dasar ini dan ikuti idiom umum bahasa tersebut.

## 1. Arsitektur & struktur

Nama layer dan struktur folder yang persis diatur di file referensi bahasa. Aturan umumnya:

Contoh struktur berdasarkan fitur (modular), bukan berdasarkan jenis file (Node/TS):

```
src/
├── modules/
│   └── order/
│       ├── order.controller.ts   # HTTP: parse request, panggil service, format response
│       ├── order.service.ts      # business logic, transaksi
│       ├── order.repository.ts   # akses DB saja
│       ├── order.schema.ts       # validasi input/output (zod/joi/pydantic)
│       └── order.test.ts
├── shared/        # error, logger, middleware, util
├── config/        # env yang divalidasi saat startup
└── main.ts
```

- Arah dependency satu arah: controller → service → akses data. Tidak boleh terbalik.
- Service tidak tahu apa-apa soal HTTP (tidak menerima `req`/`res`).
- Dependency di-inject lewat constructor atau parameter supaya mudah di-test.

## 2. API design (REST)

- Resource berbentuk kata benda jamak: `GET /orders`, `GET /orders/:id`, `POST /orders`, `PATCH /orders/:id`, `DELETE /orders/:id`
- Aksi non-CRUD: `POST /orders/:id/cancel`
- Versioning: `/api/v1/...`
- Status code: 200 OK, 201 Created, 204 No Content, 400 validasi, 401 belum login, 403 tidak berhak, 404 tidak ditemukan, 409 konflik, 422 aturan bisnis, 429 rate limit, 500 error server
- Format response konsisten:
  ```json
  { "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 134 } }
  { "error": { "code": "ORDER_NOT_FOUND", "message": "Order tidak ditemukan", "details": [] } }
  ```
- Pagination wajib untuk list (cursor untuk data besar, offset untuk admin panel).
- Field JSON pakai camelCase, tanggal pakai ISO 8601 UTC.
- Endpoint yang dipicu dari pembayaran atau webhook harus idempotent (`Idempotency-Key`).

## 3. Validasi & error handling

- Validasi semua input di boundary dengan schema. Tolak field yang tidak dikenal.
- Pakai kelas error bertipe (`NotFoundError`, `ValidationError`, `ForbiddenError`) dan satu global error handler yang memetakannya ke HTTP.
- Jangan pernah `catch` lalu diam. Log atau lempar ulang dengan konteks.
- Jangan kirim stack trace atau pesan error DB ke client.

## 4. Database

- Setiap perubahan skema lewat migration yang bisa di-rollback. Jangan edit migration yang sudah jalan.
- Tabel punya `id`, `created_at`, `updated_at`. Soft delete (`deleted_at`) hanya kalau memang dibutuhkan.
- Pasang index di kolom yang dipakai di WHERE, JOIN, dan ORDER BY, serta di foreign key.
- Hindari N+1: pakai eager load atau batch.
- Operasi yang mengubah banyak tabel dibungkus transaksi.
- Uang disimpan sebagai integer (sen) atau DECIMAL, **tidak pernah float**.
- Migration di tabel besar: tambah kolom nullable → backfill bertahap → baru pasang constraint.
- Selalu pakai parameterized query, jangan merangkai string.

## 5. Auth & security

- Hash password pakai argon2 atau bcrypt (cost ≥ 12).
- Access token berumur pendek (±15 menit), refresh token disimpan di cookie `HttpOnly; Secure; SameSite`.
- Cek authorization di service: pastikan resource milik user yang sedang login (cegah IDOR).
- Pasang rate limit di login, OTP, dan reset password.
- Secret diambil dari env. Kalau env yang wajib tidak ada, aplikasi gagal start.
- CORS pakai whitelist origin, jangan `*` bersama credentials.

## 6. Caching

- Pola cache-aside: baca cache → kalau miss, baca DB → tulis ke cache dengan TTL.
- Invalidasi cache saat data berubah. Key punya namespace dan versi (`v1:order:123`).
- Jangan cache data per-user di key global.

## 7. Async & background job

- Pekerjaan lambat (email, laporan, webhook keluar) dilempar ke queue.
- Job harus idempotent, punya retry dengan backoff, dan dead-letter queue.

## 8. Logging & observability

- Log terstruktur (JSON) berisi `requestId`, `userId`, dan `durationMs`.
- Level: `error` (perlu tindakan), `warn` (anomali), `info` (event bisnis), `debug` (dev saja).
- Jangan log password, token, atau data kartu.
- Sediakan endpoint `/health` (liveness) dan `/ready` (cek DB/cache).

## 9. Testing

- Unit test untuk service (repository di-mock).
- Integration test untuk endpoint dengan DB test sungguhan.
- Uji happy path, validasi gagal, tidak berhak (401/403), dan tidak ditemukan (404).

## 10. Kode

- Fungsi kecil dengan satu tanggung jawab. Early return, hindari nesting dalam.
- Nama deskriptif, tanpa singkatan yang tidak umum. Tidak ada magic number (pakai konstanta).
- Tidak ada `any` atau tipe longgar di boundary.
