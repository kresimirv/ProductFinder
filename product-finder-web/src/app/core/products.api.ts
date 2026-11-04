import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_URL, FilterOptions, Paginated, Product } from './api.models';
import { ProductSearch, searchToParams } from './product-search';

/**
 * Catalogue read endpoints. The resources are signal-driven: they refetch when
 * their input changes and cancel stale requests. Call the methods in an injection
 * context, e.g. a component field initializer.
 */
@Injectable({ providedIn: 'root' })
export class ProductsApi {
  /** One page of products for the given search; refetches whenever the search signal changes. */
  search(search: () => ProductSearch): HttpResourceRef<Paginated<Product> | undefined> {
    return httpResource<Paginated<Product>>(() => ({
      url: `${API_URL}/products`,
      params: searchToParams(search()),
    }));
  }

  /** Values for the filter controls (loaded once per page visit). */
  filterOptions(): HttpResourceRef<FilterOptions | undefined> {
    return httpResource<FilterOptions>(() => `${API_URL}/products/filters`);
  }

  /** One product with its rating summary; refetches when the SKU changes. */
  product(sku: () => string): HttpResourceRef<Product | undefined> {
    return httpResource<Product>(() => `${API_URL}/products/${encodeURIComponent(sku())}`);
  }
}
