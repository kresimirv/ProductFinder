import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, NewReview, Paginated, Review } from './api.models';

/** Review endpoints: reading (signal resource) and writing, the app's only write flow. */
@Injectable({ providedIn: 'root' })
export class ReviewsApi {
  private readonly http = inject(HttpClient);

  /** The newest `limit()` reviews of a product. Call in an injection context. */
  list(sku: () => string, limit: () => number): HttpResourceRef<Paginated<Review> | undefined> {
    return httpResource<Paginated<Review>>(() => ({
      url: reviewsUrl(sku()),
      params: { pageSize: limit() },
    }));
  }

  /**
   * Publishes a review. Errors are returned as HttpErrorResponse (400 invalid,
   * 404 unknown product, 429 rate limit) for the page to explain.
   */
  create(sku: string, review: NewReview): Observable<Review> {
    return this.http.post<Review>(reviewsUrl(sku), review);
  }
}

/** URL of a product's reviews; the SKU is encoded so it can't alter the path. */
function reviewsUrl(sku: string): string {
  return `${API_URL}/products/${encodeURIComponent(sku)}/reviews`;
}
