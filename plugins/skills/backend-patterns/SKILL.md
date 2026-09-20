---
name: backend-patterns
description: Aturan coding dan arsitektur backend profesional. Mencakup layering, API design REST + OpenAPI, error RFC 9457, validasi, database & migration zero-downtime, auth & security (OWASP), resiliency, caching, async job, observability (OpenTelemetry), dan testing, plus aturan per bahasa/framework (.NET/C#, dll.). Pakai saat menulis, mengubah, atau mendesain kode backend/API/service/database.
---

# Backend Patterns

Konvensi di codebase yang ada **selalu menang**. Pakai aturan ini kalau project belum punya aturan sendiri, atau kalau sedang membuat project baru.

## 0. Aturan per bahasa (baca dulu)

File ini berisi **aturan dasar** untuk semua bahasa. Setiap bahasa/framework punya file tambahan di folder `references/`. **Kalau aturan bahasa bertentangan dengan aturan dasar, aturan bahasa yang menang.**

Kenali bahasa project dari file yang ada, lalu baca file yang cocok **sebelum menulis kode**:

| Tanda di project | Baca file |
|---|---|
| `*.sln`, `*.slnx`, `*.csproj`, `Program.cs` | [references/dotnet.md](references/dotnet.md) |

Ada juga [references/runtime.md](references/runtime.md) (caching, background job, observability) yang dibaca **berdasarkan kebutuhan**, bukan berdasarkan bahasa.

Kalau bahasanya belum punya file referensi, pakai aturan dasar ini dan ikuti idiom umum bahasa tersebut.

## 1. Arsitektur

- **Layering satu arah:** controller/handler (HTTP) → service (business logic) → akses data. Tidak boleh terbalik. Nama layer dan struktur persisnya diatur di file referensi bahasa.
- **Controller tipis:** hanya parse request, panggil service, dan format response. Tidak berisi business logic dan tidak query DB.
- **Service tidak tahu soal HTTP:** tidak menerima `req`/`res`, dan melempar error domain, bukan status code.
- Dependency di-inject (constructor/parameter) supaya bisa di-test. Jangan pakai global state atau singleton yang bisa diubah.
- Kode dikelompokkan per fitur/modul kalau stack-nya mendukung, supaya perubahan satu fitur tidak menyebar ke banyak folder.
- **Mulai dari monolith modular.** Pecah jadi microservice hanya kalau ada alasan nyata: skala tim, skala beban, atau domain yang benar-benar terpisah.

## 2. API design (REST)

**Kontrak dulu.** Endpoint didokumentasikan di **OpenAPI** (generate dari kode atau ditulis duluan). Dokumentasinya harus selalu sinkron dengan implementasi.

- **Resource** berupa kata benda jamak: `GET /orders`, `GET /orders/{id}`, `POST /orders`, `PATCH /orders/{id}`, `DELETE /orders/{id}`
- **Aksi non-CRUD:** `POST /orders/{id}/cancel`
- **Versioning** di path: `/api/v1/...`. Breaking change berarti versi baru.
- **Deprecation:** versi lama diberi header `Deprecation` dan `Sunset`, lalu diumumkan sebelum dihapus.
- **Status code:**

| Kode | Arti |
|---|---|
| 200 | OK |
| 201 | Created (dengan header `Location`) |
| 202 | Accepted (diproses async) |
| 204 | No Content |
| 400 | Request tidak valid (format/validasi) |
| 401 | Belum login / token invalid |
| 403 | Login, tapi tidak berhak |
| 404 | Tidak ditemukan (juga dipakai untuk resource milik orang lain, supaya keberadaannya tidak bocor) |
| 409 | Konflik state/duplikat/versi |
| 422 | Valid secara format, tapi melanggar aturan bisnis |
| 429 | Rate limit (dengan header `Retry-After`) |
| 500 / 503 | Error server / layanan sementara tidak tersedia |

- **Response sukses** konsisten. Untuk list, pakai envelope dengan metadata pagination:
  ```json
  { "data": [ ... ], "meta": { "page": 1, "pageSize": 20, "total": 134 } }
  ```
- **Pagination** wajib untuk list, dengan batas maksimal `pageSize` (misalnya 100). Pakai cursor-based untuk data besar atau feed.
- **Filter & sort** lewat query string yang di-whitelist: `?status=paid&sort=-createdAt`.
- **Format data:**
  - Field JSON pakai camelCase.
  - Waktu pakai ISO 8601 UTC (`2026-09-18T10:00:00Z`).
  - Uang ditulis sebagai string/decimal atau minor unit, ditambah field `currency`.
  - ID sebaiknya tidak berurutan untuk resource publik (UUID/ULID).
- **Idempotency:** `POST` untuk pembayaran, order, atau webhook menerima header `Idempotency-Key`. Request ulang dengan key yang sama mengembalikan hasil yang sama.
- **Concurrency:** untuk update yang bisa bertabrakan, pakai optimistic concurrency (`ETag`/`If-Match` atau kolom versi), lalu kembalikan 409/412 kalau terjadi konflik.

## 3. Error handling (RFC 9457 Problem Details)

Semua error dikembalikan dengan format standar `application/problem+json`:

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

- Pakai error bertipe (`NotFound`, `Validation`, `Forbidden`, `Conflict`, `BusinessRule`) dan **satu global error handler** yang memetakannya ke HTTP.
- `code` bersifat stabil dan bisa dipakai client untuk logika. Isi `detail` boleh berubah-ubah.
- **Error 500:** client hanya menerima pesan generik dan `traceId`. Detail lengkap dan stack trace hanya masuk ke log.
- **Jangan pernah `catch` lalu diam.** Tangani error, atau lempar ulang dengan konteks tambahan. Kalau terjadi kondisi tak terduga, sistem harus **fail closed** (menolak), bukan lanjut dalam keadaan tidak aman.

## 4. Validasi

- Validasi **semua input dari luar** (body, query, header, webhook, message queue) di boundary memakai schema.
- Pakai allowlist, bukan blocklist. Tolak atau abaikan field yang tidak dikenal.
- **Jangan binding request langsung ke entity DB** (mass assignment). Pakai DTO.
- Batasi ukuran: panjang string, jumlah item array, ukuran body, dan ukuran file.
- Validasi format ada di schema. Validasi aturan bisnis (stok, saldo, status) ada di service.

## 5. Database

- Setiap perubahan skema lewat **migration** yang di-review dan bisa di-rollback. Jangan edit migration yang sudah di-apply di environment bersama.
- **Zero-downtime migration (expand → migrate → contract):**
  1. Tambah kolom/tabel baru yang nullable, tanpa mengganggu kode lama.
  2. Deploy kode yang menulis ke kolom lama dan baru, lalu backfill data secara bertahap.
  3. Pindahkan pembacaan ke kolom baru.
  4. Hapus kolom lama di rilis berikutnya.
- Hindari lock panjang di tabel besar. Buat index secara concurrent/online kalau DB mendukung.
- Setiap tabel punya primary key, `created_at`, dan `updated_at`. Soft delete hanya kalau ada kebutuhan bisnis atau audit.
- **Index** dipasang di foreign key dan kolom yang dipakai di WHERE, JOIN, dan ORDER BY. Cek query plan untuk query yang berat.
- **Hindari N+1:** pakai eager loading, proyeksi, atau batching. Jangan query di dalam loop.
- **Transaksi** untuk operasi yang mengubah beberapa data sekaligus. Transaksi harus pendek, dan tidak boleh memanggil API eksternal di dalamnya.
- **Uang** disimpan sebagai DECIMAL atau integer minor unit, **tidak pernah float**.
- Selalu pakai parameterized query/ORM. Raw SQL wajib memakai parameter.
- Constraint di DB (unique, foreign key, not null, check) adalah lapisan pertahanan terakhir. Jangan hanya mengandalkan validasi di kode.

## 6. Auth & security (OWASP)

- Pakai library atau identity provider yang matang. **Jangan membuat crypto atau auth sendiri.**
- **Password:**
  - Hash dengan argon2id (atau bcrypt cost ≥ 12).
  - Panjang minimal 8 karakter, dicek terhadap daftar password yang bocor.
  - Tidak ada aturan komposisi yang aneh-aneh.
- **Token:**
  - Access token berumur pendek (±15 menit).
  - Refresh token di-rotate dan bisa dicabut, disimpan di cookie `HttpOnly; Secure; SameSite`.
  - JWT diverifikasi lengkap: signature, `exp`, `iss`, dan `aud`.
- **Authorization di setiap request, di level resource:** cek kepemilikan atau tenant, bukan hanya "sudah login" (mencegah IDOR/BOLA). Default-nya deny.
- **Rate limit** di login, OTP, reset password, dan endpoint mahal.
- **Audit log** untuk aksi sensitif: login, ubah password/role, transaksi, dan hapus data.
- **CORS** memakai whitelist origin, tidak pernah `*` bersama credentials.
- **Security header** dipasang: HSTS, `X-Content-Type-Options`, dan CSP untuk response HTML.
- **Webhook masuk** diverifikasi signature dan timestamp-nya (mencegah replay).
- **Dependency** di-scan secara rutin, dan lockfile di-commit.

## 7. Resiliency

- **Setiap panggilan jaringan wajib punya timeout.** Tidak ada panggilan tanpa batas waktu.
- **Retry** hanya untuk operasi yang idempotent dan error yang sementara (5xx, timeout), dengan exponential backoff + jitter dan batas jumlah percobaan.
- **Circuit breaker** untuk dependency yang sering bermasalah, dan sediakan fallback atau degradasi yang wajar.
- **Graceful shutdown:** saat menerima SIGTERM, berhenti menerima request dan selesaikan yang sedang berjalan.
- **Konsistensi DB ↔ event:** kalau perubahan DB harus diikuti publish event, pakai **transactional outbox**, bukan publish di tengah transaksi.

## 8. Caching, async job & observability

Baca [references/runtime.md](references/runtime.md) **kalau** pekerjaanmu menyentuh cache, queue/background job, atau logging/metric/tracing. Aturan minimum yang berlaku selalu:

- **Log terstruktur (JSON)** dengan `traceId`. **Jangan log** password, token, OTP, atau PII.
- Job dan operasi yang bisa di-retry harus **idempotent**.
- Cache hanya untuk masalah performa yang **terukur**, bukan dipasang di mana-mana.

## 9. Testing

- **Unit test:** business logic di service. Dependency eksternal di-mock seperlunya.
- **Integration test:** endpoint + DB sungguhan (Testcontainers atau DB test). Ini yang paling berharga untuk backend.
- **Contract test:** kalau API dipakai tim atau service lain, pastikan response sesuai skema OpenAPI.
- **Wajib diuji:** happy path, validasi gagal (400), 401/403, akses resource orang lain, 404, konflik (409), dan aturan bisnis (422).
- Setiap bug fix disertai regression test.
- Test harus independen dan deterministik: data di-seed per test, dan waktu memakai clock yang bisa di-mock.

## 10. Kualitas kode

- Fungsi kecil dengan satu tanggung jawab. Early return, hindari nesting yang dalam.
- Nama deskriptif sesuai bahasa domain bisnis, tanpa singkatan yang tidak umum.
- Tidak ada magic number/string. Pakai konstanta atau enum.
- Tipe yang ketat di boundary. Tidak ada `any`/`dynamic`/`object` longgar.
- Linter + formatter + analyzer dijalankan di CI, dan warning ditangani.
- Komentar menjelaskan **kenapa**, bukan **apa**. Dokumentasikan API publik dan keputusan yang tidak jelas.
- Mengikuti prinsip YAGNI: jangan membuat abstraksi untuk kebutuhan yang belum ada.

### SOLID (secukupnya)

- **SRP** — satu class punya satu alasan untuk berubah. Service yang menangani order, email, dan laporan sekaligus dipecah.
- **OCP** — aturan yang terus bertambah (metode bayar, jenis diskon, provider) diperluas lewat strategy/handler yang didaftarkan, bukan dengan `if`/`switch` yang tumbuh tiap ada kasus baru.
- **LSP** — implementasi tidak mempersempit kontrak interface-nya: tidak melempar "not supported", dan tidak mengubah makna return value.
- **ISP** — interface kecil sesuai kebutuhan pemanggil. Lebih baik `IOrderReader` + `IOrderWriter` daripada satu `IOrderRepository` berisi 20 method yang cuma dipakai sebagian.
- **DIP** — service bergantung pada abstraksi (`IPaymentGateway`, `IClock`), bukan pada `DbContext`/HTTP client/`DateTime.UtcNow` secara langsung. Ini yang membuat business logic bisa di-test tanpa infrastruktur.

**Rem YAGNI — ini yang membedakan SOLID dari over-engineering:** buat abstraksi baru hanya kalau **sudah ada ≥2 implementasi nyata**, atau abstraksi itu memang dibutuhkan untuk test. Satu implementasi + satu interface "buat jaga-jaga" adalah biaya tanpa manfaat. Refactor ke SOLID saat kebutuhan keduanya muncul, bukan sebelumnya.
