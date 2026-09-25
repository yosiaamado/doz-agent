---
name: backend-patterns
description: Aturan coding dan arsitektur backend profesional. Mencakup layering, API design REST + OpenAPI, error RFC 9457, validasi, database & migration zero-downtime, auth & security (OWASP), resiliency, caching, async job, observability (OpenTelemetry), dan testing, plus aturan per bahasa/framework (.NET/C#, dll.). Pakai saat menulis, mengubah, atau mendesain kode backend/API/service/database.
---

# Backend Patterns

Isinya **keputusan default** untuk hal yang belum diatur project, bukan tutorial. Konvensi di codebase yang ada **selalu menang**. Jangan menambahkan pola dari sini (versioning, envelope, `Idempotency-Key`, outbox, dll.) ke project yang belum memakainya, kecuali spec memintanya: pola yang tidak konsisten dengan sekitarnya lebih mahal daripada pola yang kurang ideal.

## 0. Aturan per bahasa

Aturan bahasa **menimpa** aturan dasar di bawah. Kenali bahasa project, lalu baca file yang cocok **sebelum menulis kode**:

| Tanda di project | Baca file |
|---|---|
| `*.sln`, `*.slnx`, `*.csproj`, `Program.cs` | [references/dotnet.md](references/dotnet.md) |

[references/runtime.md](references/runtime.md) (caching, background job, observability) dibaca hanya kalau pekerjaannya menyentuh hal itu. Bahasa tanpa file referensi: pakai aturan dasar + idiom umum bahasanya.

## 1. Arsitektur

- Satu arah: controller/handler (hanya HTTP: parse request, panggil service, format response) → service (business logic) → akses data. Service tidak menerima `req`/`res`, dan melempar error domain, bukan status code.
- Kode dikelompokkan per fitur/modul. Mulai dari monolith modular; pecah jadi service terpisah hanya kalau ada alasan nyata (skala tim, skala beban, domain yang benar-benar terpisah).

## 2. API

- **Kontrak dulu:** endpoint didokumentasikan di OpenAPI dan selalu sinkron dengan implementasi.
- Aksi non-CRUD: `POST /orders/{id}/cancel`. Project baru: versi di path (`/api/v1`). Breaking change = versi baru; versi lama diberi header `Deprecation`/`Sunset` sebelum dihapus.
- Status code yang sering salah pilih: **404 juga untuk resource milik orang lain** (keberadaannya tidak boleh bocor) · 400 = format/validasi, 422 = valid tapi melanggar aturan bisnis · 409 = konflik state/duplikat/versi · 201 dengan `Location` · 429 dengan `Retry-After`.
- List memakai envelope `{ "data": [...], "meta": { "page": 1, "pageSize": 20, "total": 134 } }`. Pagination wajib; semua query param numerik (`page`, `pageSize`, `limit`, `offset`) punya batas bawah **dan** atas (misalnya `pageSize` 1–100), di luar batas → 400, dan offset dihitung tanpa overflow. Cursor untuk data besar atau feed. Filter & sort lewat query string yang di-whitelist (`?status=paid&sort=-createdAt`).
- Data: JSON camelCase · waktu ISO 8601 UTC · uang string/decimal atau minor unit + field `currency` · ID resource publik tidak berurutan (UUID/ULID).
- `POST` untuk pembayaran, order, dan webhook menerima `Idempotency-Key`: request ulang dengan key yang sama mengembalikan hasil yang sama.
- Update yang bisa bertabrakan memakai optimistic concurrency (`ETag`/`If-Match` atau kolom versi), dan mengembalikan 409/412 kalau konflik.

## 3. Error (RFC 9457)

Semua error `application/problem+json`, dari **satu global error handler** yang memetakan error bertipe (`NotFound`, `Validation`, `Forbidden`, `Conflict`, `BusinessRule`) ke HTTP:

```json
{
  "type": "https://api.example.com/errors/order-not-found",
  "title": "Order tidak ditemukan",
  "status": 404,
  "detail": "Order 7f3c... tidak ditemukan",
  "instance": "/api/v1/orders/7f3c...",
  "code": "ORDER_NOT_FOUND",
  "traceId": "00-4bf92f...",
  "errors": { "items[0].qty": ["Harus lebih dari 0"] }
}
```

- `code` stabil dan boleh dipakai client untuk logika; isi `detail` boleh berubah.
- Error 500: client hanya menerima pesan generik + `traceId`. Detail dan stack trace hanya masuk log.
- Tidak ada `catch` yang diam: tangani, atau lempar ulang dengan konteks. Kondisi tak terduga → **fail closed** (menolak), bukan lanjut dalam keadaan tidak aman.

## 4. Validasi

- Semua input dari luar (body, query, header, webhook, message queue) divalidasi di boundary dengan schema: allowlist, field tak dikenal ditolak atau diabaikan, panjang string/jumlah item/ukuran body & file dibatasi.
- Request tidak pernah di-binding langsung ke entity DB (mass assignment); pakai DTO. Response juga DTO yang hanya berisi field yang dipakai konsumen: jangan kirim email/data pribadi yang tidak perlu.
- Validasi format ada di schema; aturan bisnis (stok, saldo, status) ada di service.

## 5. Database

- Perubahan skema lewat migration yang di-review dan bisa di-rollback. Migration yang sudah di-apply di environment bersama tidak diedit.
- Mengubah kolom/data lama: **expand → migrate → contract**. Tambah kolom baru yang nullable → tulis ke kolom lama dan baru + backfill bertahap → pindahkan pembacaan ke kolom baru → hapus kolom lama di rilis berikutnya. Index di tabel besar dibuat concurrent/online supaya tidak ada lock panjang.
- Setiap tabel punya primary key, `created_at`, dan `updated_at`. Soft delete hanya kalau ada kebutuhan bisnis atau audit.
- Index untuk foreign key dan kolom filter/sort baru.
- Transaksi untuk perubahan beberapa data sekaligus, dibuat pendek dan tanpa panggilan API eksternal di dalamnya.
- Uang disimpan sebagai DECIMAL atau integer minor unit, **tidak pernah float**. Query selalu berparameter.
- Constraint DB (unique, foreign key, not null, check) tetap dipasang sebagai lapisan pertahanan terakhir.

## 6. Auth & security

- Pakai library atau identity provider yang matang. **Jangan membuat crypto atau auth sendiri.**
- Password: argon2id (atau bcrypt cost ≥ 12), minimal 8 karakter, dicek ke daftar password yang bocor, tanpa aturan komposisi.
- Token: access token ±15 menit; refresh token di-rotate, bisa dicabut, dan disimpan di cookie `HttpOnly; Secure; SameSite`; JWT diverifikasi signature, `exp`, `iss`, dan `aud`.
- **Authorization di setiap request, di level resource:** cek kepemilikan/tenant, bukan hanya "sudah login" (mencegah IDOR/BOLA). Default deny.
- Rate limit di login, OTP, reset password, dan endpoint mahal · audit log untuk login, ubah password/role, transaksi, dan hapus data · CORS pakai whitelist, tidak pernah `*` bersama credentials · security header (HSTS, `X-Content-Type-Options`) kalau belum dipasang di proxy · webhook masuk diverifikasi signature + timestamp (cegah replay).

## 7. Resiliency

- Setiap panggilan jaringan punya timeout.
- Retry hanya untuk operasi idempotent dan error sementara (5xx, timeout), dengan exponential backoff + jitter dan batas percobaan.
- Perubahan DB yang harus diikuti publish event memakai **transactional outbox**, bukan publish di tengah transaksi.

## 8. Log, job & cache

Detail di [references/runtime.md](references/runtime.md). Yang selalu berlaku: log terstruktur (JSON) dengan `traceId`, tanpa password/token/OTP/PII · job dan operasi yang bisa di-retry harus idempotent · cache hanya untuk masalah performa yang terukur.

## 9. Testing

- Integration test endpoint + DB sungguhan (Testcontainers atau DB test) paling berharga untuk backend. Unit test untuk business logic di service, dependency eksternal di-mock seperlunya.
- Wajib diuji: happy path, validasi gagal (400), 401/403, akses resource orang lain, 404, konflik (409), dan aturan bisnis (422). Setiap bug fix disertai regression test. Contract test kalau API dipakai tim atau service lain.
- Deterministik: data di-seed per test, waktu lewat clock yang bisa di-mock.

## 10. Desain kode

- Dependency yang perlu diganti di test (payment gateway, clock, HTTP client ke layanan lain) diakses lewat abstraksi yang di-inject, bukan global state atau singleton. Akses DB mengikuti aturan bahasa; di .NET, service memakai `DbContext` langsung tanpa layer repository.
- **Rem YAGNI:** abstraksi baru hanya kalau **sudah ada ≥2 implementasi nyata**, atau memang dibutuhkan untuk test. Satu implementasi + satu interface "buat jaga-jaga" adalah biaya tanpa manfaat.
- Aturan yang terus bertambah (metode bayar, jenis diskon, provider) diperluas lewat strategy/handler yang didaftarkan, bukan `if`/`switch` yang tumbuh. Mulai saat kasus keduanya muncul, bukan sebelumnya.
- Tipe ketat di boundary (tanpa `any`/`dynamic`/`object` longgar) dan tanpa magic number/string. Komentar menjelaskan **kenapa**, bukan apa.
