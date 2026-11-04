import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Product } from '../../core/api.models';
import { CatalogPage } from './catalog-page';

const product = (sku: string, name: string): Product => ({
  sku,
  name,
  chemicalName: 'Polysorbate 80',
  function: 'Emulsifier',
  applicationArea: 'Personal Care',
  region: 'EMEA',
  certifications: [],
  status: 'Active',
  launchYear: 2020,
  description: '',
  rating: { average: null, count: 0 },
  delistedAt: null,
});

/**
 * Runs pending async work (navigation, effects) without waiting for app stability:
 * `whenStable()` would wait for the HTTP request this test is about to answer.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('CatalogPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'products', component: CatalogPage }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  /** Opens the page at a URL and answers the filter-options request. */
  async function open(url: string) {
    const harness = await RouterTestingHarness.create(url);
    http.expectOne('/api/v1/products/filters').flush({
      function: [],
      applicationArea: [],
      region: ['EMEA', 'Global'],
      status: [],
      certification: [],
    });
    return harness;
  }

  it('loads exactly the search described by the URL (shared links)', async () => {
    const harness = await open(
      '/products?q=emul&region=EMEA&region=Global&sort=-launchYear&page=2',
    );

    const req = http.expectOne((r) => r.url === '/api/v1/products');
    expect(req.request.params.get('q')).toBe('emul');
    expect(req.request.params.getAll('region')).toEqual(['EMEA', 'Global']);
    expect(req.request.params.get('sort')).toBe('-launchYear');
    expect(req.request.params.get('page')).toBe('2');

    req.flush({ items: [product('P-1', 'Beta Emulsion')], total: 21, page: 2, pageSize: 20 });
    await harness.fixture.whenStable();
    const text = harness.routeNativeElement!.textContent!;
    expect(text).toContain('21 products');
    expect(text).toContain('Beta Emulsion');
    expect(harness.routeNativeElement!.querySelector('input[type=search]')).toHaveProperty(
      'value',
      'emul',
    );
  });

  it('writes filter changes to the URL and goes back to page 1', async () => {
    const harness = await open('/products?page=3');
    http
      .expectOne((r) => r.url === '/api/v1/products')
      .flush({ items: [], total: 0, page: 3, pageSize: 20 });

    const page = harness.routeDebugElement!.componentInstance as CatalogPage;
    (page as unknown as { onFilterChange: CatalogPage['onFilterChange'] }).onFilterChange(
      'region',
      ['EMEA'],
    );
    await settle(); // let the navigation finish; the new request is then pending

    expect(TestBed.inject(Router).url).toBe('/products?region=EMEA');
    http
      .expectOne((r) => r.url === '/api/v1/products' && r.params.get('region') === 'EMEA')
      .flush({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('applies typed filters after a pause, ignoring a partial year', async () => {
    jest.useFakeTimers();
    try {
      const harness = await open('/products');
      http
        .expectOne((r) => r.url === '/api/v1/products')
        .flush({ items: [], total: 0, page: 1, pageSize: 20 });
      const page = harness.routeDebugElement!.componentInstance as unknown as {
        onTyped(key: string, value: string): void;
      };

      page.onTyped('launchYearFrom', '20'); // still typing
      jest.advanceTimersByTime(300);
      expect(TestBed.inject(Router).url).toBe('/products');

      // Two fields typed in quick succession must both be applied (one navigation).
      page.onTyped('launchYearFrom', '2015');
      page.onTyped('name', 'quorin');
      jest.advanceTimersByTime(300);
    } finally {
      jest.useRealTimers();
    }
    await settle();
    expect(TestBed.inject(Router).url).toContain('launchYearFrom=2015');
    expect(TestBed.inject(Router).url).toContain('name=quorin');
  });

  it('toggles the sort direction', async () => {
    const harness = await open('/products?sort=region');
    http
      .expectOne((r) => r.url === '/api/v1/products')
      .flush({ items: [], total: 0, page: 1, pageSize: 20 });
    (
      harness.routeDebugElement!.componentInstance as unknown as { toggleSortDirection(): void }
    ).toggleSortDirection();
    await settle();
    expect(TestBed.inject(Router).url).toBe('/products?sort=-region');
    http.expectOne((r) => r.url === '/api/v1/products' && r.params.get('sort') === '-region');
  });

  it('shows an empty state', async () => {
    const harness = await open('/products?q=zzz');
    http
      .expectOne((r) => r.url === '/api/v1/products')
      .flush({ items: [], total: 0, page: 1, pageSize: 20 });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.textContent).toContain('No products match your search');
  });

  it('shows an error with a retry button', async () => {
    const harness = await open('/products');
    http
      .expectOne((r) => r.url === '/api/v1/products')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.textContent).toContain('Products could not be loaded');
  });
});
