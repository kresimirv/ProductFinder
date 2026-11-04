import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './test-database';

/**
 * Runs once before all e2e suites. It brings the test database up to the latest
 * migrations, creating it if needed, the same way a fresh environment is set up
 * (README). It's non-destructive; each suite resets its own data via `resetFixtures`.
 */
export default function globalSetup(): void {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'ignore',
  });
}
