import { TEST_DATABASE_URL } from './test-database';

// Runs in every test worker before the app is created; PrismaService reads this.
process.env.DATABASE_URL = TEST_DATABASE_URL;
