# Decisions

## 1. Architecture overview

**One repository, three parts:**
- an Angular SPA that only calls REST endpoints;
- a NestJS API that owns the database (schema through Prisma migrations, plus the CSV import);
- PostgreSQL.

nginx serves the SPA and proxies `/api`, so the browser sees one origin. Docker Compose runs `db → migrate → seed + api → web` with one command. The details are in [ARCHITECTURE.md](ARCHITECTURE.md).

**Guiding principle: start simple, keep scale-out cheap.** v1 is a **modular monolith**. With ~200 products today, ~50k in two years and one write flow, microservices, queues or a search engine would add cost without user benefit. The design keeps these next steps open:
- more API instances (no session state; only the rate limiter is in memory, §4);
- splitting catalogue, reviews and import into services along the existing module boundaries;
- a queue in front of the import;
- read replicas, caching or a search engine behind the unchanged REST contract.

## 2. Key decisions

| Decision | Alternatives | Why |
|---|---|---|
| Modular monolith, REST + OpenAPI, products addressed by SKU | Microservices; GraphQL; DB ids in URLs | Fits the size. SKUs are stable and readable in shared links. |
| **The PIM CSV is the source of truth.** The export is never modified: it's split into the day's `products_imported_<date>.csv` (unique SKUs, as exported) and `products_error_<date>.csv` (every row of a duplicated SKU, rows without `sku`/`name`); same-day files are replaced. The imported file is upserted by `sku` in **one transaction** (1k-row `INSERT … ON CONFLICT` batches, unchanged rows skipped). | "Last row wins"; "most restrictive status wins"; truncate and reload; per-row upserts | Picking a winner would invent business data (P-10151 is both Active and Discontinued), so the error file goes back to the PM. The import is idempotent, keeps reviews, never shows a half-imported catalogue, and the dated files are an audit trail. Prisma has no bulk upsert. |
| **Delist, don't delete:** after a successful import, products whose SKU is missing from the export (rejected rows count as present) get `delisted_at`. They're hidden from search and filters; their page stays with a banner, reviews are kept, and they're relisted if the SKU returns. | Delete them; keep showing them | "Customers always see current data" without destroying reviews or breaking shared links. Reversible and audited (`import_run.delisted_rows`). |
| Minimal cleaning: trim, split certifications, invalid year → NULL + warning; `status` as exported | Status enum; rejecting bad years | Stays faithful to the PIM. A missing year shouldn't hide a product. |
| Product table **mirrors the CSV** (+ UUID `id`, timestamps), not normalised | 3NF now; stored rating aggregates | The value sets and the rule for unknown values aren't known, so normalising now would mean inventing them. The surrogate `id` lets 3NF follow without touching reviews. |
| `pg_trgm` index on `name` only; ratings computed at query time | Elasticsearch; indexes on every column | Partial name search is the hot path. More indexes can be added when query plans show the need. |
| Discontinued products hidden from search; detail page kept, with a banner | Show all; delete | Addresses the sales complaint, and old links still work. |
| **The URL is the only frontend state** | NgRx or a service store | "Share a link" and back/forward work by construction. One pure function maps state ⇄ URL ⇄ API. |
| Imports are started only by the CLI / `seed`. **Read-only** `GET /imports` and `GET /imports/:id` | Upload or trigger endpoint | Without authentication, a write endpoint would let anyone replace the catalogue. |
| **PrimeNG 21.1.10 (MIT) + Angular 21** *(tech lead's decision after testing)* | PrimeNG 22 + Angular 22 | PrimeNG 22 is commercial (it needs a key and shows a licence banner), and the client doesn't qualify for the free tier. A licence-free UI library outweighs one Angular major version, and Angular 21 is in LTS. A deliberate deviation from "latest stable". |
| NestJS 11 + Jest 30 (CommonJS); Prisma 7.10.1 pinned; `jest-preset-angular`; e2e tests on real Postgres | NestJS 12 (ESM, Vitest); `prisma@latest` (an RC); Vitest; mocked DB | Jest is required, and its ESM mode is experimental. Avoid release candidates. The behaviour that matters (filters, arrays, constraints, upsert SQL) lives in Postgres. |
| Compose: one-off `migrate`, `seed` on every `up`, `/health` readiness, nginx with `trust proxy` (private networks only) | Migrate on API start; manual seed; trusting all proxies | No migration race between instances. One command gives a working app. The rate limit applies per client and can't be spoofed. |
| Reviews: display name only, validation in DTO and DB, 5 posts/min per client | Email/IP; CAPTCHA | Without login, personal data can't be verified (GDPR). Rate limiting is the cheapest guard. |

## 3. Assumptions

- **"Current data"** means the latest successful import. A failed import changes nothing, and the failed run is visible in `import_run`.
- An invalid launch year doesn't block a product. Rejected SKUs that are already in the DB stay unchanged and listed.
- **A product missing from one successful export is delisted immediately** (no grace period). Reviews remain allowed on delisted products.
- **Search** covers name, SKU and chemical name. Every column except SKU is filterable. 8 columns are sortable (not description or certifications).
- **Reviews** are allowed on any product and published immediately (moderation is out of scope).
- **Mobile-first**; English only.

**Open questions for the client:**
1. How duplicate SKUs and rows without `sku`/`name` should be resolved. Until then, they stay listed with their last good data.
2. The allowed values for function, area, region, status and certifications (including future business units). Are variants like `active` / `Phase out` PIM errors, and how should unknown values be handled? This is a precondition for 3NF.

## 4. Risks & issues

| Risk | Status |
|---|---|
| **Dirty PIM data** (duplicates, missing names, status spellings, whitespace, `n/a` years, quoted fields) | *Addressed* by the error file, trimming, NULL years and an RFC 4180 parser, all tested on the real file. *Open:* `Phase out` and `Phase-out` stay two values until the PIM is fixed. One malformed row fails the whole import: safe, but it blocks the update. |
| **Growth to 50k products** | *Mitigated* by server-side filtering, sorting and paging, the trigram index, and batched import. |
| **Products no longer sold** | *Addressed:* discontinued products are hidden by default, and products dropped from the PIM are delisted automatically. *Open:* there's no safety guard (a decision), so a truncated but valid export would delist everything missing from it. It's reversible by re-importing a full export. |
| **Public reviews** | *Mitigated* by validation, plain text and per-client rate limiting. *Open:* no moderation, and rotating IPs gets around the limit. |
| **In-memory rate limiter** | Fine with one API instance. Several instances need a shared store (e.g. Redis). |
| **Dependencies and licences** | 0 vulnerabilities in production dependencies (`multer` and `js-yaml` patched via `overrides`); the remaining findings are in dev-only tooling. `httpResource` is experimental in Angular 21 (stable in 22). The PrimeNG licence was caught in testing; no third-party logos are used. |

## 5. Left out & next steps

**Left out on purpose:** authentication and moderation, facet counts, sorting by rating, a nightly schedule, `helmet`/CORS (same origin), a custom error format, SSR, frontend ESLint (Prettier and strict types only).

**Next steps:**
1. **User management and authentication** (OpenID Connect/SSO with roles), so all APIs are secured and write and admin endpoints are restricted to the right users. This is a prerequisite for steps 5 and 6.
2. A nightly scheduled import (cron or a platform job), with an alert on failed runs (`finished_at IS NULL`).
3. Hardening: TLS, secrets, CI (tests, lint, images), metrics, a shared rate-limit store.
4. **Error logging:** a global exception filter writing structured logs (request id, route, status, stack) to files or a log platform, optionally also to an `error_log` table.
5. **Admin app** (behind auth): manage products and data quality, review rejected rows, later moderate reviews. Kept separate, so the catalogue stays read-only.
6. **More import endpoints** (behind auth): `POST /imports`, downloads of the day's files, and a retention policy for them.
7. Quality: frontend ESLint, Playwright e2e tests, an accessibility audit.
8. 3NF once the value sets are confirmed. Upgrades: NestJS 12 when Jest's ESM mode is stable; Angular 22+ with an MIT PrimeNG or a PrimeUI licence.
