# Architecture

How the Product Finder is built. [DECISIONS.md](DECISIONS.md) explains *why*; this document describes *what* and *how*.

## Components and data flow

```
                ┌──────────────── Docker Compose ────────────────┐
 Browser        │                                                │
 (phone/desk) ──┼─► web (nginx) ── /api/* ──► api (NestJS) ──► db (Postgres)
                │    Angular SPA               │   ▲            │
                │                              │   │ same code  │
 PIM nightly    │                  seed (import CLI)            │
 products.csv ──┼──────────────────────►                        │
                └────────────────────────────────────────────────┘
```

- **nginx** serves the Angular build and forwards `/api/*` (including `/api/docs`) to NestJS. The browser sees one origin, so there's no CORS. Only nginx is published (port 8080). It overwrites `X-Forwarded-For` with the real peer address, and the API trusts only private-network proxies, so the per-client rate limit can't be spoofed.
- **Startup order:** `db` (healthy) → `migrate` (one-off `prisma migrate deploy`) → `seed` (one-off import of `data/products.csv`) and `api` (healthy when `GET /api/v1/health` reaches the DB) → `web`. A single API image runs `migrate`, `seed` and `api`; only `migrate` builds it.
- **The import** is a CLI that boots the Nest application context without HTTP and reuses the API's Prisma code.

```
product-finder-api/   NestJS backend: REST API, Prisma schema + migrations, CSV import CLI
product-finder-web/   Angular + PrimeNG frontend (nginx config + Dockerfile)
data/                 PIM export (products.csv, never modified) and the per-day imported/error files
docker-compose.yml    whole stack: db, migrate, seed, api, web
```

## Backend (`product-finder-api`, NestJS 11, Prisma 7)

| Module | Responsibility |
|---|---|
| `products` | search, filter options, detail (`products.service.ts`; query rules as pure functions in `product-query.ts`) |
| `reviews` | list and create reviews (the only write flow), rate-limited |
| `import` | CSV pipeline + CLI (`import.main.ts`); read-only import status endpoints (`imports.controller.ts`) |
| `health` | `GET /health`: DB ping, 503 if unreachable |
| `prisma` | global `PrismaService` (pg driver adapter) |
| `common` | pagination DTO/envelope, query transforms (`ToArray`, `Trim`) |

Controllers handle HTTP only, services hold the logic and call Prisma directly (no repository layer, except the import's raw-SQL repository). `app.setup.ts` holds the global HTTP setup (prefix `api/v1`, `ValidationPipe`, trust proxy) and is shared by `main.ts` and the e2e tests. OpenAPI docs (`/api/docs`) are generated from the DTOs and their TSDoc by the `@nestjs/swagger` CLI plugin.

### REST API (`/api/v1`)

| User story | Endpoint |
|---|---|
| Search and narrow down | `GET /products` with `q`, value filters, text filters and a year range (see below); `GET /products/filters` returns the values each filter can offer and the min/max launch year |
| Browse and sort | `GET /products?sort=<field>` or `-<field>` for `sku`, `name`, `chemicalName`, `function`, `applicationArea`, `region`, `status`, `launchYear`; `page`, `pageSize` (max 100). Response `{ items, total, page, pageSize }` |
| See all product information | `GET /products/:sku`: all CSV fields + `rating: { average, count }` |
| Share a link | no endpoint: GETs are stateless, all state is in the URL, and ordering is deterministic (SKU tie-breaker) |
| Read reviews | `GET /products/:sku/reviews` (newest first, paginated) |
| Write a review | `POST /products/:sku/reviews` `{ rating 1–5, title?, body, authorName }` |
| PM: latest PIM export | the import CLI / `seed` service (no endpoint to *start* an import); status via `GET /imports` and `GET /imports/:id`, which return the `import_run` columns |

**Filters:**
- `q` matches name, SKU and chemical name (case-insensitive, partial).
- **Value filters** `chemicalName`, `function`, `applicationArea`, `region`, `status` and `certification` are repeatable. Values within one filter are OR'ed, but certifications must *all* match. All of these are case-insensitive.
- **Text filters** `name` and `description` match by "contains".
- **Year range** `launchYearFrom` / `launchYearTo`. Once a range is set, products with an unknown year are excluded.
- Different filters are AND'ed.
- **Discontinued products** are excluded unless `status` is given.
- **Delisted products** are always excluded, from results and from `/products/filters`. `GET /products/:sku` still returns them, with `delistedAt`, so old shared links show a "no longer in the catalogue" banner.

**Reviews:** `rating` must be an integer 1–5. Text is trimmed and length-limited, unknown fields are rejected, and the same limits are enforced again in the DB. Output is plain text (Angular escapes it). Rate limit: 5 per minute per client (`@nestjs/throttler`, POST only, in-memory).

### Data model (`prisma/schema.prisma`, migration `init`)

- **`product`:** the CSV columns plus a surrogate `id` (UUID v7), `created_at` and `updated_at`.
  - `sku` is UNIQUE (the upsert key).
  - `certifications` is `text[]`; `status` is stored as exported; `launch_year` is a nullable `smallint`.
  - `delisted_at`: set by the import when the SKU is missing from the latest export (NULL = listed).
  - The only index is a `pg_trgm` GIN index on `name`.
- **`review`:** `id`, `product_id` (FK, `ON DELETE RESTRICT`), `rating` (with `CHECK 1–5`), `title` ≤120, `body` ≤2000, `author_name` ≤60, `created_at`. Indexed on `(product_id, created_at DESC)`.
- **`import_run`:** one audit row per import: `file_name`, `total_rows`, `processed_rows` (inserted + updated + relisted), `delisted_rows`, `started_at`, and `finished_at` (NULL means the run failed).
- **Ratings** are computed at query time (`AVG`/`COUNT`).
- **Hand-written SQL in the migration:** `CREATE EXTENSION pg_trgm` and the rating `CHECK`.
- **Path to 3NF:** lookup tables for function, area, region and status, and a certification join table. Reviews reference `product.id`, so they aren't affected.

### Import (`src/import/`)

`validate-rows.ts` holds the rules as pure, unit-tested functions; `csv-files.ts` does the file I/O; `product-import.repository.ts` holds the only raw SQL; `import.service.ts` orchestrates the steps.

1. **Parse** the whole file with `csv-parse` (RFC 4180: quotes, commas, `""` escapes). If a required column is missing, the run fails before anything is written.
2. **Split into the day's files**, next to the input (`products.csv` itself is never written):
   - `products_imported_<YYYY-MM-DD>.csv`: rows with a unique SKU and a name, exactly as exported;
   - `products_error_<YYYY-MM-DD>.csv`: **every** row of a duplicated SKU and rows missing `sku` or `name`, as exported, plus `reject_reason` (header-only if nothing was rejected);
   - the same day's files from an earlier run are removed first; other days are kept.
   - `partitionRecords` (pure) decides which file each row goes to.
3. **Bulk-import the imported file.** It's read back and each row is cleaned:
   - every value is trimmed;
   - certifications are split on `|`;
   - a non-year `launch_year` becomes NULL, with a warning that gives the file and line number.
4. **Write in one transaction** (holding an advisory lock):
   - batches of 1,000 rows, each a single `INSERT … SELECT FROM jsonb_to_recordset(…) ON CONFLICT (sku) DO UPDATE … WHERE (row) IS DISTINCT FROM (new)`;
   - unchanged rows are skipped, so a re-run reports 0 processed rows;
   - new rows get `uuidv7()` as their ID;
   - **delisting:** products whose SKU isn't anywhere in the export (rejected rows count as present) get `delisted_at = now()`; a SKU that reappears is relisted (`delisted_at = NULL`). Nothing is deleted, so reviews stay;
   - the `import_run` row is created before the transaction and completed inside it.
5. **Exit code:** 0 when the import completed (rejected rows don't make it fail), 1 when nothing was imported.

On today's file, 202 rows give 197 imported products and 5 rejected rows (P-10013 ×2, P-10151 ×2, P-10119).

## Frontend (`product-finder-web`, Angular 21, PrimeNG 21 MIT)

- **Routes:** lazy `/products` (catalogue) and `/products/:sku` (detail).
- **Structure:**
  - `core/`: API types and services, the only place with URLs, plus `product-search.ts`, which maps state ⇄ URL ⇄ API as pure functions;
  - `features/catalog` and `features/product`: the pages;
  - `shared/`: status tag and status mapping, share button, not-found page.
  - Pages are the only components that inject services; everything else is presentational (`input()`/`output()`).
- **The URL query string is the single source of truth for search state.** Input updates the URL, and the URL drives an `httpResource` request (stale requests are cancelled). Typed input is applied in one navigation 300 ms after typing stops.
- **Mobile-first:** single-column cards, with filters in a Drawer on phones; a sidebar and card grid from 992 px.
- **Catalogue cards:** name, status, SKU, chemical name, function/area/region, launch year, a two-line description excerpt, certifications and rating.
- **Product page:**
  - every field;
  - a discontinued or phase-out banner;
  - the rating;
  - a Share button (native share sheet, or copy link);
  - reviews with "Show more" (5 at a time, up to 100);
  - a review form whose validation mirrors the API, with messages for 400/404/429.
- **Dev server** proxies `/api` to `localhost:3000`, so it's the same origin as in production.

## Tests (Jest)

| Suite | Covers |
|---|---|
| API unit (32) | query builder (filters, search, sorting), import partitioning, validation, mapping and file names |
| API e2e (52, real Postgres in `productfinder_test`) | all endpoints incl. import status, delisted products hidden but reachable, validation errors, 404, rate limit per client, health; import on the real CSV (empty DB, idempotent re-run, review survives, bad header, export untouched, imported/error files, same-day file replacement, delisting and relisting, rejected SKUs stay listed) |
| Web (42) | URL ⇄ state mapping, API request building, catalogue page (shared URL, filters, typing race, sort toggle, states), product page (status and delisted banners, 404, review posted, 429), review form, product card, status mapping |
