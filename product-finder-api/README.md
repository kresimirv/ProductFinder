# product-finder-api

NestJS 11 REST API of the Product Finder (`/api/v1`): catalogue search, product details, reviews, a health check, and the CSV import command. PostgreSQL through Prisma 7.

See the [root README](../README.md) for prerequisites and the full setup, and [ARCHITECTURE.md](../ARCHITECTURE.md) for how it works.

| Command | Purpose |
| ------- | ------- |
| `cp .env.example .env` | Database connection for local development |
| `npm install` | Install dependencies (also generates the Prisma client) |
| `npm run prisma:deploy` | Apply migrations to the database |
| `npm run import -- ../data/products.csv` | Import a PIM export (safe to repeat) |
| `npm run start:dev` | API with hot reload on http://localhost:3000 (docs: `/api/docs`) |
| `npm test` / `npm run test:e2e` | Unit tests / end-to-end tests (e2e need the database running) |
| `npm run lint` | ESLint + Prettier |
