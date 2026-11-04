# AI Usage

## Tools

**Claude Code (Claude Opus 5.5)**, a terminal coding agent, was used throughout: analysis, planning, implementation, tests, Docker and documentation. I led the work as tech lead. For every non-trivial step the agent first proposed a plan, and code was written only after I agreed it. I set the coding standards (YAGNI, KISS, DRY, separation of concerns, documented code) and made every product and design decision. I tested the running app myself.

## Delegated vs. done myself

- **Delegated:** profiling `products.csv`; scaffolding the projects; writing the code and tests from agreed plans; Docker/nginx setup; debugging the toolchain; drafting these documents.
- **Done myself:**
  - framing the architecture: one repository; Angular → REST → NestJS → Postgres; designed to scale out later;
  - the import rules (CSV as source of truth, quarantine, trimming, a single transaction);
  - the data model (cut down from the agent's proposal);
  - the API and UI scope per user story, including which columns are filterable and sortable and what the cards show;
  - enforcing the fixed stack (Jest over the Vitest defaults);
  - the delisting rules: delist instead of delete; SKUs that are rejected but still in the export stay listed; reviews stay allowed; no safety guard.
- **Reviewing generated output caught:**
  - vendor AI-agent files dropped into the repo by `prisma init`;
  - an RC tagged `latest` on npm;
  - a Compose build that failed on the first real run;
  - a rate limit that, behind nginx, would have applied to all customers together.
- **Where running things caught what unit tests didn't:**
  - the import's summary line wasn't printed;
  - Prisma generated wrong import paths inside Docker;
  - an nginx regex broke the config.
  - On the testing side, the agent's own async tests hung at first, and one of its e2e expectations was wrong; both times it fixed the test, not the code.

## Examples where I rejected or corrected the agent's output

### 1. Duplicate SKUs in the import
- **Agent:** found the duplicates (P-10013 identical; P-10151 both Active and Discontinued) and proposed resolving them automatically: "most restrictive status wins".
- **Me:** rejected that. Duplicates and rows without `sku`/`name` are written to the day's error file (`products_error_<YYYY-MM-DD>.csv`, next to `products_imported_<YYYY-MM-DD>.csv`, which is what gets imported) and become a question for the client. I also set the import design: the CSV is the source of truth, the file path is an argument, records are batch-upserted by `sku`.
- **Why:** picking a winner is a business decision disguised as a technical one. It would have quietly invented product data. Quarantine makes the problem visible and gives the product manager a file to fix in the PIM.

### 2. Database schema
- **Agent:** proposed a "rich" schema: a status enum with normalisation, stored rating aggregates, a `delistedAt` column, an import-run status with five counters, and indexes on every filter column. It also started editing `schema.prisma` before we'd agreed.
- **Me:** stopped the edit and required the plan to be agreed first. I cut Product down to the CSV columns plus `id` and timestamps (status as exported, certifications as `text[]`), with ratings computed at query time, one trigram index, and a minimal `ImportRun`. I recorded that it can be normalised (3NF) once the business confirms the value sets.
- **Why:** each extra column was an invented business rule or an unmeasured optimisation. A smaller, faithful schema is easier to defend and to change.

### 3. PrimeNG licence
- **Agent:** built the frontend on the newest versions (Angular 22 + PrimeNG 22). It checked peer and test-runner compatibility, but not the licence.
- **Me:** testing the app, I saw an "Invalid PrimeUI License" banner and required the free community version. The agent established that PrimeNG 22 is commercial and that the latest MIT release (21.1.10) needs Angular 21. I chose that supported pair over forcing an unsupported combination, and documented the deviation from "latest Angular".
- **Why:** a dependency's licence is a legal and business decision, not a version detail. Licence checks are now part of choosing any library.
