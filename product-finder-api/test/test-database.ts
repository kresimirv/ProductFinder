/**
 * e2e tests run against their own database (same Postgres container), so they never
 * touch development data. Override with TEST_DATABASE_URL, e.g. in CI.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://productfinder:productfinder@localhost:5432/productfinder_test?schema=public';
