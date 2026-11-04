import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, resetFixtures } from './test-app';

describe('Products API (e2e)', () => {
  let app: INestApplication<App>;
  const get = (path: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`);
  const skus = (res: request.Response) =>
    (res.body as { items: { sku: string }[] }).items.map((p) => p.sku);

  beforeAll(async () => {
    app = await createTestApp();
    await resetFixtures(app);
  });

  afterAll(() => app.close());

  describe('GET /products', () => {
    it('lists products sorted by name, hiding discontinued ones', async () => {
      const res = await get('/products').expect(200);
      expect(skus(res)).toEqual(['T-0001', 'T-0002', 'T-0003']);
      expect(res.body).toMatchObject({ total: 3, page: 1, pageSize: 20 });
    });

    it('returns public fields and a rating summary, but not the internal id', async () => {
      const res = await get('/products?q=alpha').expect(200);
      const [product] = (res.body as { items: Record<string, unknown>[] })
        .items;
      expect(product).toEqual({
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
        rating: { average: null, count: 0 },
        delistedAt: null,
      });
    });

    it.each([
      ['chemical name', 'POLYSORBATE', ['T-0002']],
      ['SKU', 't-0003', ['T-0003']],
      ['partial name', 'emul', ['T-0002']],
    ])('searches by %s', async (_, q, expected) => {
      expect(skus(await get(`/products?q=${q}`).expect(200))).toEqual(expected);
    });

    it('filters case-insensitively, ORing values within a filter', async () => {
      const res = await get('/products?status=ACTIVE').expect(200);
      expect(skus(res)).toEqual(['T-0001', 'T-0002', 'T-0003']);
      const regions = await get(
        '/products?region=global&region=Asia Pacific&status=Discontinued&status=Active',
      ).expect(200);
      expect(skus(regions)).toEqual(['T-0002', 'T-0004']); // sorted by name
    });

    it('shows discontinued products when asked for explicitly', async () => {
      const res = await get('/products?status=Discontinued').expect(200);
      expect(skus(res)).toEqual(['T-0004']);
    });

    it('requires all selected certifications', async () => {
      const res = await get(
        '/products?certification=Vegan&certification=Halal',
      ).expect(200);
      expect(skus(res)).toEqual(['T-0001']);
    });

    it('sorts by launch year descending with unknown years last', async () => {
      const res = await get('/products?sort=-launchYear').expect(200);
      expect(skus(res)).toEqual(['T-0002', 'T-0001', 'T-0003']);
    });

    it('filters by name and description text, chemical name and launch year range', async () => {
      expect(skus(await get('/products?name=EMUL').expect(200))).toEqual([
        'T-0002',
      ]);
      expect(
        skus(await get('/products?description=coatings').expect(200)),
      ).toEqual(['T-0003']);
      expect(
        skus(
          await get(
            '/products?chemicalName=sodium laureth sulfate&status=Active&status=Discontinued',
          ).expect(200),
        ),
      ).toEqual(['T-0001', 'T-0004']);
      // Unknown years (T-0003) are excluded once a range is set.
      expect(
        skus(
          await get('/products?launchYearFrom=2010&launchYearTo=2015').expect(
            200,
          ),
        ),
      ).toEqual(['T-0001']);
    });

    it('sorts by any sortable column, e.g. chemical name descending', async () => {
      const res = await get('/products?sort=-chemicalName').expect(200);
      expect(skus(res)).toEqual(['T-0001', 'T-0003', 'T-0002']);
    });

    it('paginates', async () => {
      const res = await get('/products?page=2&pageSize=2').expect(200);
      expect(skus(res)).toEqual(['T-0003']);
      expect(res.body).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    });

    it.each([
      ['an unknown sort', 'sort=price'],
      ['sorting by description', 'sort=description'],
      ['a launch year that is not a number', 'launchYearFrom=soon'],
      ['a page size above 100', 'pageSize=101'],
      ['page 0', 'page=0'],
      ['an unknown parameter', 'colour=red'],
    ])('rejects %s with 400', async (_, params) => {
      await get(`/products?${params}`).expect(400);
    });
  });

  describe('delisted products', () => {
    it('never appear in search results, whatever the filters', async () => {
      expect(skus(await get('/products?q=epsilon').expect(200))).toEqual([]);
      expect(
        skus(
          await get('/products?status=Active&chemicalName=Lecithin').expect(
            200,
          ),
        ),
      ).toEqual([]);
    });
  });

  describe('GET /products/filters', () => {
    it('returns distinct values of listed products, merging spelling variants', async () => {
      // T-0005 (delisted: Lecithin, Kosher, 1999) contributes nothing.
      const res = await get('/products/filters').expect(200);
      expect(res.body).toEqual({
        chemicalName: [
          'Polysorbate 80',
          'Propylene Glycol',
          'Sodium Laureth Sulfate',
        ],
        function: ['Emulsifier', 'Solvent', 'Surfactant'],
        applicationArea: ['Coatings', 'Home Care', 'Personal Care'],
        region: ['Asia Pacific', 'EMEA', 'Global'],
        status: ['Active', 'Discontinued'],
        certification: ['Halal', 'Vegan'],
        launchYear: { min: 2005, max: 2020 },
      });
    });
  });

  describe('GET /products/:sku', () => {
    it('returns the product, including discontinued ones (old shared links keep working)', async () => {
      const res = await get('/products/T-0004').expect(200);
      expect(res.body).toMatchObject({ sku: 'T-0004', status: 'Discontinued' });
    });

    it('still returns a delisted product, with the delisting date (old shared links)', async () => {
      const res = await get('/products/T-0005').expect(200);
      expect(res.body).toMatchObject({
        sku: 'T-0005',
        delistedAt: '2026-11-01T02:00:00.000Z',
      });
    });

    it('returns 404 for an unknown SKU', async () => {
      await get('/products/NOPE').expect(404);
    });
  });
});
