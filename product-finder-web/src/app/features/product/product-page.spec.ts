import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Product, Review } from '../../core/api.models';
import { ProductPage } from './product-page';

const PRODUCT: Product = {
  sku: 'P-10007',
  name: 'Novarel PR 590',
  chemicalName: 'Sodium Benzoate',
  function: 'Preservative',
  applicationArea: 'Personal Care',
  region: 'Global',
  certifications: ['Kosher'],
  status: 'Discontinued',
  launchYear: null,
  description: 'Preservative.',
  rating: { average: null, count: 0 },
  delistedAt: null,
};
const PRODUCT_URL = '/api/v1/products/P-10007';
const REVIEWS_URL = '/api/v1/products/P-10007/reviews';
const noReviews = { items: [] as Review[], total: 0, page: 1, pageSize: 5 };

/** Runs pending effects without waiting for app stability (which waits for open HTTP requests). */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('ProductPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: 'products/:sku', component: ProductPage }],
          withComponentInputBinding(),
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function open() {
    const harness = await RouterTestingHarness.create('/products/P-10007');
    return { harness, text: () => harness.routeNativeElement!.textContent! };
  }

  it('shows the product with a discontinued banner and no rating yet', async () => {
    const { harness, text } = await open();
    http.expectOne(PRODUCT_URL).flush(PRODUCT);
    http.expectOne((r) => r.url === REVIEWS_URL).flush(noReviews);
    await harness.fixture.whenStable();

    expect(text()).toContain('Novarel PR 590');
    expect(text()).toContain('No longer available');
    expect(text()).toContain('Not rated yet');
    expect(text()).toContain('No reviews yet');
  });

  it('explains that a delisted product is no longer in the catalogue (instead of the status banner)', async () => {
    const { harness, text } = await open();
    http.expectOne(PRODUCT_URL).flush({ ...PRODUCT, delistedAt: '2026-11-01T02:00:00.000Z' });
    http.expectOne((r) => r.url === REVIEWS_URL).flush(noReviews);
    await harness.fixture.whenStable();

    expect(text()).toContain('No longer in the catalogue');
    expect(text()).toContain('Nov 1, 2026');
    expect(text()).not.toContain('No longer available: this product has been discontinued');
  });

  it('shows "not found" for an unknown SKU', async () => {
    const { harness, text } = await open();
    http.expectOne(PRODUCT_URL).flush({}, { status: 404, statusText: 'Not Found' });
    http
      .expectOne((r) => r.url === REVIEWS_URL)
      .flush({}, { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();
    expect(text()).toContain('Product P-10007 was not found');
  });

  describe('posting a review', () => {
    const review = { rating: 5, body: 'Great', authorName: 'Ana' };

    async function submit() {
      const opened = await open();
      http.expectOne(PRODUCT_URL).flush(PRODUCT);
      http.expectOne((r) => r.url === REVIEWS_URL).flush(noReviews);
      await opened.harness.fixture.whenStable();
      const page = opened.harness.routeDebugElement!.componentInstance as unknown as {
        submitReview(r: typeof review): void;
      };
      page.submitReview(review);
      const post = http.expectOne({ method: 'POST', url: REVIEWS_URL });
      expect(post.request.body).toEqual(review);
      return { ...opened, post };
    }

    it('confirms and reloads the rating and reviews', async () => {
      const { harness, text, post } = await submit();
      post.flush({ id: '1', ...review, title: null, createdAt: '2026-11-03T10:00:00Z' });
      await settle(); // the page now reloads product and reviews

      http.expectOne(PRODUCT_URL).flush({ ...PRODUCT, rating: { average: 5, count: 1 } });
      http
        .expectOne((r) => r.url === REVIEWS_URL && r.method === 'GET')
        .flush({
          ...noReviews,
          total: 1,
          items: [{ id: '1', ...review, title: null, createdAt: '2026-11-03T10:00:00Z' }],
        });
      await harness.fixture.whenStable();

      expect(text()).toContain('Your review is published');
      expect(text()).toContain('5 · 1 review');
      expect(text()).toContain('Great');
    });

    it('explains the rate limit (429)', async () => {
      const { harness, text, post } = await submit();
      post.flush({}, { status: 429, statusText: 'Too Many Requests' });
      await harness.fixture.whenStable();
      expect(text()).toContain("You've posted several reviews recently");
    });
  });
});
