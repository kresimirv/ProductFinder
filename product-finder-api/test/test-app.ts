import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Boots the real application (same modules and global pipeline as main.ts).
 * Rate limiting is disabled unless a test is about rate limiting, because
 * validation tests would otherwise use up the quota.
 */
export async function createTestApp({ throttle = false } = {}): Promise<
  INestApplication<App>
> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (!throttle) {
    builder.overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true });
  }
  const app = (
    await builder.compile()
  ).createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

/** A small catalogue covering the cases the endpoints must handle. */
export const FIXTURE_PRODUCTS: Prisma.ProductCreateManyInput[] = [
  {
    sku: 'T-0001',
    name: 'Alpha Clean',
    chemicalName: 'Sodium Laureth Sulfate',
    function: 'Surfactant',
    applicationArea: 'Home Care',
    region: 'EMEA',
    certifications: ['Vegan', 'Halal'],
    status: 'Active',
    launchYear: 2012,
    description: 'Surfactant for home care.',
  },
  {
    sku: 'T-0002',
    name: 'Beta Emulsion',
    chemicalName: 'Polysorbate 80',
    function: 'Emulsifier',
    applicationArea: 'Personal Care',
    region: 'Global',
    certifications: ['Vegan'],
    status: 'active', // spelling variant, as found in the real PIM export
    launchYear: 2020,
    description: 'Emulsifier for personal care.',
  },
  {
    sku: 'T-0003',
    name: 'Gamma Solve',
    chemicalName: 'Propylene Glycol',
    function: 'Solvent',
    applicationArea: 'Coatings',
    region: 'EMEA',
    certifications: [],
    status: 'Active',
    launchYear: null, // e.g. 'n/a' in the CSV
    description: 'Solvent for coatings.',
  },
  {
    sku: 'T-0004',
    name: 'Delta Legacy',
    chemicalName: 'Sodium Laureth Sulfate',
    function: 'Surfactant',
    applicationArea: 'Home Care',
    region: 'Asia Pacific',
    certifications: ['Halal'],
    status: 'Discontinued',
    launchYear: 2005,
    description: 'No longer sold.',
  },
  {
    // Missing from the latest PIM export: never listed, but its page still works.
    sku: 'T-0005',
    name: 'Epsilon Gone',
    chemicalName: 'Lecithin',
    function: 'Emulsifier',
    applicationArea: 'Food & Nutrition',
    region: 'EMEA',
    certifications: ['Kosher'],
    status: 'Active',
    launchYear: 1999,
    description: 'No longer exported by the PIM.',
    delistedAt: new Date('2026-11-01T02:00:00Z'),
  },
];

/** Replaces all data with the fixture catalogue (no reviews). */
export async function resetFixtures(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.review.deleteMany();
  await prisma.product.deleteMany();
  await prisma.product.createMany({ data: FIXTURE_PRODUCTS });
}
