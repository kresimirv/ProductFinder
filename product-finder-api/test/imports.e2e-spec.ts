import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app';

describe('Imports API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const get = (path: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.importRun.deleteMany();
  });

  afterAll(() => app.close());

  it('lists import runs newest first, with all import_run columns', async () => {
    const older = await prisma.importRun.create({
      data: {
        fileName: '/data/products.csv',
        totalRows: 202,
        processedRows: 197,
        startedAt: new Date('2026-11-02T02:00:00Z'),
        finishedAt: new Date('2026-11-02T02:00:01Z'),
      },
    });
    const failed = await prisma.importRun.create({
      data: {
        fileName: '/data/broken.csv',
        startedAt: new Date('2026-11-03T02:00:00Z'),
      },
    });

    const res = await get('/imports').expect(200);

    expect(res.body).toEqual({
      items: [
        {
          id: failed.id,
          fileName: '/data/broken.csv',
          totalRows: 0,
          processedRows: 0,
          delistedRows: 0,
          startedAt: '2026-11-03T02:00:00.000Z',
          finishedAt: null, // failed run
        },
        {
          id: older.id,
          fileName: '/data/products.csv',
          totalRows: 202,
          processedRows: 197,
          delistedRows: 0,
          startedAt: '2026-11-02T02:00:00.000Z',
          finishedAt: '2026-11-02T02:00:01.000Z',
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });
  });

  it('returns one run by id', async () => {
    const run = await prisma.importRun.create({
      data: { fileName: '/data/products.csv' },
    });
    const res = await get(`/imports/${run.id}`).expect(200);
    expect(res.body).toMatchObject({
      id: run.id,
      fileName: '/data/products.csv',
    });
  });

  it('returns 404 for an unknown id and 400 for a malformed one', async () => {
    await get('/imports/0190f4f6-0000-7000-8000-000000000000').expect(404);
    await get('/imports/not-a-uuid').expect(400);
  });
});
