# product-finder-web

Angular 21 + PrimeNG 21 (MIT) frontend of the Product Finder: catalogue with search, filters and sorting, product details and reviews. Mobile-first.

See the [root README](../README.md) for prerequisites and the full setup, and [ARCHITECTURE.md](../ARCHITECTURE.md) for how it works.

| Command | Purpose |
| ------- | ------- |
| `npm install` | Install dependencies |
| `npm start` | Dev server on http://localhost:4200; `/api` is proxied to the API on port 3000 |
| `npm test` | Type-check the specs, then run the Jest tests |
| `npm run build` | Production build into `dist/` (served by nginx in Docker) |
