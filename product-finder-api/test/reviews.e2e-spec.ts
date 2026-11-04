import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, resetFixtures } from './test-app';

const validReview = {
  rating: 4,
  title: 'Easy to formulate with',
  body: 'Stable emulsions even at low use levels.',
  authorName: 'Formulation chemist',
};

describe('Reviews API (e2e)', () => {
  let app: INestApplication<App>;
  const api = () => request(app.getHttpServer());
  const post = (sku: string, body: object) =>
    api().post(`/api/v1/products/${sku}/reviews`).send(body);

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => resetFixtures(app));

  afterAll(() => app.close());

  it('creates a review and reflects it in the product rating', async () => {
    const res = await post('T-0002', validReview).expect(201);
    expect(res.body).toEqual({
      id: expect.any(String) as string,
      ...validReview,
      createdAt: expect.any(String) as string,
    });

    await post('T-0002', { ...validReview, rating: 5 }).expect(201);
    const product = await api().get('/api/v1/products/T-0002').expect(200);
    expect(product.body).toMatchObject({ rating: { average: 4.5, count: 2 } });
  });

  it('lists reviews newest first, paginated', async () => {
    for (const rating of [1, 2, 3]) {
      await post('T-0001', { ...validReview, rating }).expect(201);
    }
    const res = await api()
      .get('/api/v1/products/T-0001/reviews?pageSize=2')
      .expect(200);
    expect(res.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(
      (res.body as { items: { rating: number }[] }).items.map((r) => r.rating),
    ).toEqual([3, 2]);
  });

  it('trims input and stores an empty title as null', async () => {
    const res = await post('T-0001', {
      ...validReview,
      title: '   ',
      authorName: '  Jane  ',
    }).expect(201);
    expect(res.body).toMatchObject({ title: null, authorName: 'Jane' });
  });

  it.each([
    ['a rating above 5', { rating: 6 }],
    ['a non-integer rating', { rating: 3.5 }],
    ['a rating sent as a string', { rating: '4' }],
    ['a whitespace-only body', { body: '   ' }],
    ['a missing author name', { authorName: undefined }],
    ['an author name over 60 characters', { authorName: 'x'.repeat(61) }],
    ['an unknown field', { productId: 'x' }],
  ])('rejects %s with 400', async (_, override) => {
    await post('T-0001', { ...validReview, ...override }).expect(400);
  });

  it('accepts reviews for a delisted product (past experience stays useful)', async () => {
    await post('T-0005', validReview).expect(201);
  });

  it('returns 404 when the product does not exist', async () => {
    await post('NOPE', validReview).expect(404);
    await api().get('/api/v1/products/NOPE/reviews').expect(404);
  });
});

describe('Reviews API rate limiting (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp({ throttle: true });
    await resetFixtures(app);
  });

  afterAll(() => app.close());

  /** Supertest connects from localhost, a trusted proxy address, like nginx in Docker. */
  const postAs = (clientIp: string) =>
    request(app.getHttpServer())
      .post('/api/v1/products/T-0001/reviews')
      .set('X-Forwarded-For', clientIp)
      .send(validReview);

  it('limits each client (by X-Forwarded-For from a trusted proxy) to 5 reviews a minute', async () => {
    for (let i = 0; i < 5; i++) await postAs('203.0.113.1').expect(201);
    await postAs('203.0.113.1').expect(429);

    // Another customer behind the same proxy is not affected.
    await postAs('203.0.113.2').expect(201);
  });
});
