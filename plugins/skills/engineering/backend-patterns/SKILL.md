---
name: backend-patterns
description: Professional backend coding and architecture rules. Covers layering, REST + OpenAPI API design, RFC 9457 errors, validation, database & zero-downtime migrations, auth & security (OWASP), resiliency, caching, async jobs, observability (OpenTelemetry), and testing, plus per-language/framework rules (.NET/C#, etc.). Use when writing, changing, or designing backend/API/service/database code.
---

# Backend Patterns

This is a set of **default decisions** for things the project hasn't settled, not a tutorial. Conventions in the existing codebase **always win**. Don't add a pattern from here (versioning, envelopes, `Idempotency-Key`, outbox, etc.) to a project that doesn't already use it, unless the spec asks for it: a pattern inconsistent with its surroundings costs more than a less-than-ideal one.

## 0. Per-language rules

Language rules **override** the base rules below. Identify the project's language, then read the matching file **before writing code**:

| Sign in the project | Read |
|---|---|
| `*.sln`, `*.slnx`, `*.csproj`, `Program.cs` | [references/dotnet.md](references/dotnet.md) |

[references/runtime.md](references/runtime.md) (caching, background jobs, observability) is read only if the work touches those. A language with no reference file: use the base rules + that language's common idioms.

## 1. Architecture

- One direction: controller/handler (HTTP only: parse the request, call the service, format the response) → service (business logic) → data access. Services don't take `req`/`res`, and they throw domain errors, not status codes.
- Code is grouped per feature/module. Start from a modular monolith; split into separate services only for a real reason (team scale, load scale, genuinely separate domains).

## 2. API

- **Contract first:** endpoints are documented in OpenAPI and stay in sync with the implementation.
- Non-CRUD actions: `POST /orders/{id}/cancel`. New projects: version in the path (`/api/v1`). A breaking change = a new version; the old version gets `Deprecation`/`Sunset` headers before removal.
- Status codes most often picked wrong: **404 for someone else's resource too** (its existence must not leak) · 400 = format/validation, 422 = valid but violates a business rule · 409 = state conflict/duplicate/version · 201 with `Location` · 429 with `Retry-After`.
- Lists use the envelope `{ "data": [...], "meta": { "page": 1, "pageSize": 20, "total": 134 } }`. Pagination is mandatory; every numeric query param (`page`, `pageSize`, `limit`, `offset`) has a lower **and** upper bound (e.g. `pageSize` 1–100), out of bounds → 400, and the offset is computed without overflow. Cursors for large data sets or feeds. Filtering & sorting via a whitelisted query string (`?status=paid&sort=-createdAt`).
- Data: JSON camelCase · times ISO 8601 UTC · money as a string/decimal or minor units + a `currency` field · public resource IDs are non-sequential (UUID/ULID).
- `POST` for payments, orders, and webhooks accepts `Idempotency-Key`: a repeat request with the same key returns the same result.
- Updates that can collide use optimistic concurrency (`ETag`/`If-Match` or a version column), and return 409/412 on conflict.

## 3. Errors (RFC 9457)

Every error is `application/problem+json`, from **a single global error handler** that maps typed errors (`NotFound`, `Validation`, `Forbidden`, `Conflict`, `BusinessRule`) to HTTP:

```json
{
  "type": "https://api.example.com/errors/order-not-found",
  "title": "Order not found",
  "status": 404,
  "detail": "Order 7f3c... not found",
  "instance": "/api/v1/orders/7f3c...",
  "code": "ORDER_NOT_FOUND",
  "traceId": "00-4bf92f...",
  "errors": { "items[0].qty": ["Must be greater than 0"] }
}
```

- `code` is stable and clients may branch on it; the contents of `detail` may change.
- 500 errors: the client gets only a generic message + `traceId`. Details and stack traces go to the log only.
- No silent `catch`: handle it, or rethrow with context. An unexpected condition → **fail closed** (reject), don't continue in an unsafe state.

## 4. Validation

- All external input (body, query, headers, webhooks, message queues) is validated at the boundary against a schema: allowlist, unknown fields rejected or ignored, limits on string length/item count/body & file size.
- A request is never bound straight to a DB entity (mass assignment); use a DTO. Responses are DTOs too, containing only the fields consumers use: don't send emails or personal data that isn't needed.
- Format validation lives in the schema; business rules (stock, balance, status) live in the service.

## 5. Database

- Schema changes go through reviewed, rollback-able migrations. A migration already applied in a shared environment is never edited.
- Changing an existing column/data: **expand → migrate → contract**. Add a new nullable column → write to both the old and new column + backfill incrementally → move reads to the new column → drop the old column in a later release. Indexes on large tables are built concurrently/online so there's no long lock.
- Every table has a primary key, `created_at`, and `updated_at`. Soft delete only where there's a business or audit need.
- Indexes for foreign keys and for new filter/sort columns.
- Transactions for changes spanning several rows, kept short and with no external API calls inside them.
- Money is stored as DECIMAL or as integer minor units, **never a float**. Queries are always parameterised.
- DB constraints (unique, foreign key, not null, check) stay in place as the last line of defence.

## 6. Auth & security

- Use a mature library or identity provider. **Don't roll your own crypto or auth.**
- Passwords: argon2id (or bcrypt cost ≥ 12), at least 8 characters, checked against a breached-password list, no composition rules.
- Tokens: access token ~15 minutes; refresh tokens are rotated, revocable, and stored in an `HttpOnly; Secure; SameSite` cookie; JWTs are verified for signature, `exp`, `iss`, and `aud`.
- **Authorization on every request, at the resource level:** check ownership/tenant, not just "is logged in" (prevents IDOR/BOLA). Default deny.
- Rate limits on login, OTP, password reset, and expensive endpoints · audit logs for login, password/role changes, transactions, and data deletion · CORS uses a whitelist, never `*` together with credentials · security headers (HSTS, `X-Content-Type-Options`) if the proxy doesn't already set them · incoming webhooks verified by signature + timestamp (prevents replay).

## 7. Resiliency

- Every network call has a timeout.
- Retries only for idempotent operations and transient errors (5xx, timeouts), with exponential backoff + jitter and an attempt limit.
- A DB change that must be followed by publishing an event uses a **transactional outbox**, not a publish in the middle of the transaction.

## 8. Logs, jobs & cache

Details in [references/runtime.md](references/runtime.md). What always applies: structured logs (JSON) with a `traceId`, no passwords/tokens/OTPs/PII · jobs and retryable operations must be idempotent · cache only for a measured performance problem.

## 9. Testing

- Integration tests against the endpoint + a real DB (Testcontainers or a test DB) are the most valuable thing for a backend. Unit tests for business logic in services, external dependencies mocked as needed.
- Must be tested: happy path, failed validation (400), 401/403, accessing someone else's resource, 404, conflict (409), and business rules (422). Every bug fix comes with a regression test. Contract tests if the API is consumed by another team or service.
- Deterministic: data seeded per test, time via a mockable clock.

## 10. Code design

- Dependencies that need swapping in tests (payment gateway, clock, HTTP client to another service) are reached through an injected abstraction, not global state or a singleton. DB access follows the language's rules; in .NET, services use `DbContext` directly with no repository layer.
- **The YAGNI brake:** a new abstraction only when **there are already ≥2 real implementations**, or it's genuinely needed for tests. One implementation plus one interface "just in case" is cost without benefit.
- Rules that keep growing (payment methods, discount types, providers) are extended via a registered strategy/handler, not an ever-growing `if`/`switch`. Start when the second case shows up, not before.
- Strict types at the boundary (no loose `any`/`dynamic`/`object`) and no magic numbers/strings.
- **Comments: few, and only for why.** Default to none — names and types carry the what. Comment only a non-obvious reason, constraint, workaround (link the issue), or gotcha, in one or two lines. No doc comments (XML doc/docstrings) on private/internal members or self-explanatory public ones; only on a published library/SDK surface or where the project already requires them. Never restate the code, narrate steps, record change history ("added for X", "fixed bug"), add section banners, or leave commented-out code. Match the comment density of the surrounding file.
