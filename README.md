# Product Finder

Product Finder for the specialty-chemicals catalogue: search, filter and compare products, share links, and read and write reviews. How it's built: [ARCHITECTURE.md](ARCHITECTURE.md). Why: [DECISIONS.md](DECISIONS.md). How AI was used: [AI_USAGE.md](AI_USAGE.md).

## Quick start (Docker, whole stack)

Only Docker is needed:

```bash
docker compose up --build
```

Then open **http://localhost:8080**. The API docs are at http://localhost:8080/api/docs.

On every `up`, Compose runs these steps in order:

1. **`db`:** PostgreSQL 18 starts (data in the volume `product-finder_db-data`).
2. **`migrate`:** creates or updates the schema from the Prisma migrations, then exits.
3. **`seed`:** imports `data/products.csv`, then exits. Safe on every start: products are upserted, reviews are kept, and a re-run reports `0 inserted/updated`. It writes the day's `data/products_imported_<YYYY-MM-DD>.csv` and `data/products_error_<YYYY-MM-DD>.csv` (see below); `products.csv` itself is never modified.
4. **`api`:** NestJS, internal only. Healthy when `GET /api/v1/health` can reach the database.
5. **`web`:** nginx on port 8080 serves the Angular app and forwards `/api/*` to the API.

Other useful commands:

| Command | Purpose |
| ------- | ------- |
| `docker compose logs seed` | See the import summary and warnings |
| `docker compose run --rm seed` | Re-import while the stack is running (e.g. after replacing `data/products.csv`) |
| `docker compose down` | Stop everything (data is kept) |
| `docker compose down -v` | Stop and **delete all data**; the next `up` starts from an empty database |

Ports can be changed in `.env` (see `.env.example`): `WEB_PORT` (default 8080) and `POSTGRES_PORT` (default 5432).

The sections below describe running the apps **without Docker** for development (hot reload, tests).

## Prerequisites

- [Docker Engine](https://docs.docker.com/engine/install/) with the Compose plugin (`docker compose version` must work). This is all you need for the quick start.
- For local development and the tests: Node.js **24 LTS** with npm 11. Both apps contain an `.nvmrc`; with [nvm](https://github.com/nvm-sh/nvm), run `nvm install && nvm use` inside the app folder.

## Getting started

### 1. Configure the environment (optional)

```bash
cp .env.example .env
```

Every variable has a default in `docker-compose.yml`, so this step is only needed if you want to change credentials or the port.

### 2. Start the database

Only the database runs in Docker during development:

```bash
docker compose up -d db
docker compose ps        # wait until db shows "healthy"
docker compose exec db psql -U productfinder -d productfinder -c 'select version();'   # optional connection check
```

This starts PostgreSQL 18 on `localhost:5432` (user, password and database are all `productfinder`). The data lives in the named volume `product-finder_db-data` and survives restarts.

To stop it: `docker compose down`. To also **delete all data**: `docker compose down -v`.

### 3. Start the backend (NestJS)

```bash
cd product-finder-api
cp .env.example .env     # DATABASE_URL for Prisma, matches the Docker database
npm install              # also generates the Prisma client (postinstall)
npm run prisma:deploy    # create the schema in the (empty) database from prisma/migrations
npm run start:dev        # API on http://localhost:3000/api/v1
```

Interactive API documentation (OpenAPI / Swagger UI): **http://localhost:3000/api/docs**. The raw spec is at `/api/docs-json`.

#### API endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/v1/products` | Search, filter, sort and paginate. Query: `q` (name/SKU/chemical); value filters `chemicalName`, `function`, `applicationArea`, `region`, `status`, `certification` (repeatable); `name` and `description` (contains); `launchYearFrom`, `launchYearTo`; `sort` = `sku`, `name`, `chemicalName`, `function`, `applicationArea`, `region`, `status` or `launchYear`, prefixed with `-` for descending; `page`, `pageSize` (max 100). Discontinued products are hidden unless `status` is given. |
| GET | `/api/v1/products/filters` | Available values for each filter, plus the launch year range |
| GET | `/api/v1/products/:sku` | Product detail with `rating: { average, count }` |
| GET | `/api/v1/products/:sku/reviews` | Reviews, newest first (`page`, `pageSize`) |
| GET | `/api/v1/imports` | Import runs, newest first (`page`, `pageSize`); read-only |
| GET | `/api/v1/imports/:id` | One import run: file, total and processed rows, start/finish (`finishedAt: null` = failed) |
| POST | `/api/v1/products/:sku/reviews` | Create a review: `{ rating: 1–5, title?, body, authorName }`. Rate-limited to 5 per minute per client. |

Example: `curl 'http://localhost:3000/api/v1/products?q=polysorbate&region=EMEA&sort=-launchYear'`

Prisma scripts (run in `product-finder-api/`):

| Command | Purpose |
| ------- | ------- |
| `npm run prisma:generate` | Regenerate the Prisma client after a schema change |
| `npm run prisma:migrate` | Create and apply a migration in development (`prisma migrate dev`) |
| `npm run prisma:deploy` | Apply existing migrations, e.g. on a fresh database (`prisma migrate deploy`) |

### 4. Start the frontend (Angular)

In a second terminal (the API from step 3 must be running):

```bash
cd product-finder-web
npm install
npm start                # http://localhost:4200
```

Open **http://localhost:4200**. The dev server forwards `/api/*` to the API on port 3000 (`proxy.conf.json`), so the browser talks to a single origin and no CORS setup is needed.

The catalogue is empty until the data is imported (next section).

| URL | Page |
| --- | ---- |
| `http://localhost:4200/products` | Catalogue: search, filters, sort, paging. All state is in the URL, so any view can be shared as a link. |
| `http://localhost:4200/products/P-10001` | Product details, rating, reviews and the review form |
| `http://localhost:3000/api/docs` | API documentation (Swagger UI) |

## Seeding / importing data

The database is filled from the PIM export with an import command (run in `product-finder-api/`, after `npm run prisma:deploy`):

```bash
npm run import -- ../data/products.csv     # builds, then imports the given file
```

Expected output for the sample export:

```
WARN  products_imported_2026-11-03.csv line 91 (P-10091): launch_year "" is not a year, stored as empty
WARN  products_imported_2026-11-03.csv line 105 (P-10105): launch_year "n/a" is not a year, stored as empty
LOG   202 rows: 197 imported (…/data/products_imported_2026-11-03.csv), 5 rejected (…/data/products_error_2026-11-03.csv). 197 inserted/updated, 0 unchanged, 0 delisted, 2 warning(s).
```

- **Works on an empty database** once the migrations have run.
- **Safe to run more than once:** products are upserted by `sku`. A second run of the same file reports `0 inserted/updated`; a changed export only updates what changed.
- **Never touches reviews:** user data lives in its own table.
- **Reflects the latest export:** a product whose SKU is missing from the export (rejected rows count as present) is **delisted**. It disappears from search and filters, its page still opens with a "no longer in the catalogue" banner, and its reviews are kept. If the SKU comes back in a later export, the product is listed again.
- **All or nothing:** the whole import runs in one transaction. If it fails (exit code 1), the database is unchanged.
- **The input file is never modified.** Next to it, the import writes two files named after the current date:
  - `products_imported_<YYYY-MM-DD>.csv`: the rows with a unique SKU and a name, exactly as exported. **The bulk import reads this file.**
  - `products_error_<YYYY-MM-DD>.csv`: every row of a duplicated SKU and rows missing SKU or name, as exported, plus a `reject_reason` column (`DUPLICATE_SKU`, `MISSING_SKU`, `MISSING_NAME`). These need to be clarified with the business and fixed in the PIM.
  - If the import runs again on the same day, both files are removed first and recreated. Files from other days are kept.
- Every run is recorded in the `import_run` table (file, total rows, processed rows, start/finish time). You can inspect it in Swagger (http://localhost:8080/api/docs → **imports**) via `GET /api/v1/imports` and `GET /api/v1/imports/{id}`. A run with `finishedAt: null` failed.

## Running tests

Backend (Jest):

```bash
cd product-finder-api
npm test                 # unit tests (no database needed)
npm run test:e2e         # end-to-end tests: real HTTP + real PostgreSQL
npm run test:cov         # unit tests with a coverage report
```

The e2e tests need the database container running (step 2). They use a separate database, `productfinder_test`, on the same server. It is created and migrated automatically before the run (`prisma migrate deploy`), and each suite loads its own fixtures, so development data is never touched. Set `TEST_DATABASE_URL` to use a different database.

Frontend (Jest via `jest-preset-angular`, no backend needed):

```bash
cd product-finder-web
npm test
```
