import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { convertToParamMap } from '@angular/router';
import { ProductSearch, searchFromParams } from './product-search';

/** A search as the catalogue page builds it: from URL query params. */
const searchOf = (params: Record<string, string | string[]> = {}): ProductSearch =>
  searchFromParams(convertToParamMap(params));
import { ProductsApi } from './products.api';

describe('ProductsApi', () => {
  let http: HttpTestingController;
  let api: ProductsApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(ProductsApi);
  });

  afterEach(() => http.verify());

  it('sends the search as query params, repeating multi-value filters', () => {
    const search = signal(searchOf({ q: 'emul', region: ['EMEA', 'Global'], page: '2' }));
    TestBed.runInInjectionContext(() => api.search(search));
    TestBed.tick();

    const req = http.expectOne((r) => r.url === '/api/v1/products');
    expect(req.request.params.get('q')).toBe('emul');
    expect(req.request.params.getAll('region')).toEqual(['EMEA', 'Global']);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.has('sort')).toBe(false); // default isn't sent
  });

  it('refetches when the search changes', () => {
    const search = signal(searchOf());
    TestBed.runInInjectionContext(() => api.search(search));
    TestBed.tick();
    http.expectOne('/api/v1/products').flush({ items: [], total: 0, page: 1, pageSize: 20 });

    search.update((s) => ({ ...s, sortField: 'launchYear', sortDirection: 'desc' }));
    TestBed.tick();
    expect(http.expectOne((r) => r.url === '/api/v1/products').request.params.get('sort')).toBe(
      '-launchYear',
    );
  });

  it('encodes the SKU in the product URL', () => {
    TestBed.runInInjectionContext(() => api.product(() => 'P-1/2'));
    TestBed.tick();
    http.expectOne('/api/v1/products/P-1%2F2');
  });
});
