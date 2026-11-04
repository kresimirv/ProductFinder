/**
 * The catalogue's search state and its mapping to and from URL query parameters.
 *
 * The URL is the single source of truth: every view can be shared as a link and
 * restored exactly (user story "send a colleague a link"). The API uses the same
 * parameter names, so the same mapping also builds the API request (DRY).
 * These are pure functions, unit-tested in product-search.spec.ts.
 */
import { ParamMap } from '@angular/router';

/** Filters with a list of selectable values (OR within a filter). */
export const FILTER_KEYS = [
  'chemicalName',
  'function',
  'applicationArea',
  'region',
  'certification',
  'status',
] as const;
/** Name of a value filter (also its URL and API parameter). */
export type FilterKey = (typeof FILTER_KEYS)[number];
/** Selected values per value filter. */
export type Filters = Record<FilterKey, string[]>;

/** Free-text inputs: quick search over name/SKU/chemical, and "contains" filters. */
export const TEXT_KEYS = ['q', 'name', 'description'] as const;
/** Launch year range bounds. */
export const YEAR_KEYS = ['launchYearFrom', 'launchYearTo'] as const;
/** Name of a free-text input. */
export type TextKey = (typeof TEXT_KEYS)[number];
/** Name of a launch-year bound. */
export type YearKey = (typeof YEAR_KEYS)[number];

/** Sortable columns (all except description and certifications), with their UI labels. */
export const SORT_FIELDS = [
  { label: 'Name', value: 'name' },
  { label: 'SKU', value: 'sku' },
  { label: 'Chemical name', value: 'chemicalName' },
  { label: 'Function', value: 'function' },
  { label: 'Application area', value: 'applicationArea' },
  { label: 'Region', value: 'region' },
  { label: 'Status', value: 'status' },
  { label: 'Launch year', value: 'launchYear' },
] as const;
/** A sortable column (the API's `sort` value without direction). */
export type SortField = (typeof SORT_FIELDS)[number]['value'];
/** Sort direction; descending is written as a `-` prefix in the URL. */
export type SortDirection = 'asc' | 'desc';

/** Page size of the catalogue list. Same as the API default, so it's not in the URL. */
export const PAGE_SIZE = 20;

/** Complete state of the catalogue view, derived from (and written to) the URL. */
export interface ProductSearch extends Record<TextKey, string>, Record<YearKey, number | null> {
  filters: Filters;
  sortField: SortField;
  sortDirection: SortDirection;
  page: number;
}

/** Sort used when the URL has none; it's left out of the URL to keep links short. */
export const DEFAULT_SORT_FIELD: SortField = 'name';

/** A fresh state with no value filters selected. */
export function emptyFilters(): Filters {
  return {
    chemicalName: [],
    function: [],
    applicationArea: [],
    region: [],
    certification: [],
    status: [],
  };
}

/** Reads the search state from the URL. Missing or invalid values fall back to defaults. */
export function searchFromParams(params: ParamMap): ProductSearch {
  const filters = emptyFilters();
  for (const key of FILTER_KEYS) filters[key] = params.getAll(key).filter(Boolean);

  // `sort=name` ascending, `sort=-name` descending (the API's format).
  const sort = params.get('sort') ?? '';
  const sortDirection: SortDirection = sort.startsWith('-') ? 'desc' : 'asc';
  const field = sort.replace(/^-/, '');
  const known = SORT_FIELDS.some((f) => f.value === field);
  const page = Number(params.get('page'));

  return {
    // Text is kept as typed (not trimmed): the input is bound to it, and trimming
    // would remove a space while the user is still typing ("quorin |sf").
    q: params.get('q') ?? '',
    name: params.get('name') ?? '',
    description: params.get('description') ?? '',
    launchYearFrom: parseYear(params.get('launchYearFrom')),
    launchYearTo: parseYear(params.get('launchYearTo')),
    filters,
    sortField: known ? (field as SortField) : DEFAULT_SORT_FIELD,
    sortDirection: known ? sortDirection : 'asc',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/**
 * Turns the search state into query parameters for the URL and the API. Defaults
 * and blank values are left out, so links stay short. Multiple values become
 * repeated params (`?region=EMEA&region=Global`).
 */
export function searchToParams(search: ProductSearch): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  for (const key of TEXT_KEYS) {
    if (search[key].trim()) params[key] = search[key];
  }
  for (const key of FILTER_KEYS) {
    if (search.filters[key].length) params[key] = search.filters[key];
  }
  for (const key of YEAR_KEYS) {
    if (search[key] !== null) params[key] = String(search[key]);
  }
  if (search.sortField !== DEFAULT_SORT_FIELD || search.sortDirection === 'desc') {
    params['sort'] = (search.sortDirection === 'desc' ? '-' : '') + search.sortField;
  }
  if (search.page > 1) params['page'] = String(search.page);
  return params;
}

/** Number of active filters (excluding the quick search), shown on the mobile "Filters" button. */
export function countActiveFilters(search: ProductSearch): number {
  const values = FILTER_KEYS.reduce((sum, key) => sum + search.filters[key].length, 0);
  const texts = (['name', 'description'] as const).filter((k) => search[k].trim()).length;
  const years = YEAR_KEYS.filter((k) => search[k] !== null).length;
  return values + texts + years;
}

/** A four-digit year the API accepts, otherwise `null` (e.g. while typing "20"). */
export function parseYear(value: string | null): number | null {
  const year = Number(value);
  return value && /^\d{4}$/.test(value.trim()) && year >= 1900 && year <= 2100 ? year : null;
}
