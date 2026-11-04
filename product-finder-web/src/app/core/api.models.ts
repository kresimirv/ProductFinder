/**
 * Types of the REST API responses (product-finder-api).
 * The interactive API docs are served at /api/docs.
 */

/** All API calls are relative: same origin in production (nginx), dev-server proxy locally. */
export const API_URL = '/api/v1';

/** Envelope of every list endpoint. */
export interface Paginated<T> {
  items: T[];
  /** Number of matching items across all pages. */
  total: number;
  page: number;
  pageSize: number;
}

/** Review statistics of one product. */
export interface RatingSummary {
  /** Average rating rounded to 2 decimals; `null` when there are no reviews. */
  average: number | null;
  count: number;
}

/** A product as exported by the PIM (values cleaned by the import), plus its rating. */
export interface Product {
  sku: string;
  name: string;
  chemicalName: string;
  function: string;
  applicationArea: string;
  region: string;
  certifications: string[];
  /** As exported by the PIM, e.g. "Active", "active", "Phase-out", "Discontinued". */
  status: string;
  launchYear: number | null;
  description: string;
  rating: RatingSummary;
  /**
   * When the product disappeared from the PIM export (ISO 8601), or `null` if it's
   * listed. Delisted products never appear in search; only shared links reach them.
   */
  delistedAt: string | null;
}

/** Values each catalogue filter can offer. */
export interface FilterOptions {
  chemicalName: string[];
  function: string[];
  applicationArea: string[];
  region: string[];
  status: string[];
  certification: string[];
  /** Range of known launch years (`null` for an empty catalogue). */
  launchYear: { min: number | null; max: number | null };
}

/** A published customer review. */
export interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** Body of `POST /products/:sku/reviews`. */
export interface NewReview {
  rating: number;
  title?: string;
  body: string;
  authorName: string;
}
