/**
 * Pure translation of {@link ProductQueryDto} into Prisma `where` / `orderBy`.
 * It has no I/O, so the search and filter rules are unit-tested in isolation
 * (product-query.spec.ts).
 */
import type { Prisma } from '../generated/prisma/client';
import type {
  ProductQueryDto,
  ProductSort,
  SortField,
} from './product-query.dto';

/** Columns searched by `q`. Only `name` is indexed (trigram); the others are cheap at catalogue scale. */
const SEARCH_FIELDS = ['name', 'sku', 'chemicalName'] as const;

/** Single-valued text columns filtered by exact (case-insensitive) values. */
export const TEXT_FILTER_FIELDS = [
  'chemicalName',
  'function',
  'applicationArea',
  'region',
  'status',
] as const;
/** One of the columns in {@link TEXT_FILTER_FIELDS}. */
export type TextFilterField = (typeof TEXT_FILTER_FIELDS)[number];

/** Free-text columns filtered by "contains" (case-insensitive). */
const CONTAINS_FILTER_FIELDS = ['name', 'description'] as const;

/**
 * Hidden unless the caller filters by status explicitly. Sales reported customers
 * asking about products that are no longer sold (REQUIREMENTS §1).
 */
const DISCONTINUED = 'Discontinued';

/**
 * Case-insensitive equality on one column. Values are stored as exported by the
 * PIM, which mixes spellings like `Active` / `active` / `ACTIVE` (DECISIONS §4).
 */
function equalsIgnoringCase(
  field: TextFilterField,
  value: string,
): Prisma.ProductWhereInput {
  return { [field]: { equals: value, mode: 'insensitive' } };
}

/**
 * Builds the Prisma filter for a catalogue query. Conditions are AND'ed; the values
 * of one filter are OR'ed. Discontinued products are excluded unless the query
 * filters by status explicitly; delisted products are always excluded.
 */
export function toProductWhere(
  query: ProductQueryDto,
): Prisma.ProductWhereInput {
  // Products missing from the latest PIM export are never part of the catalogue.
  const conditions: Prisma.ProductWhereInput[] = [{ delistedAt: null }];

  if (query.q) {
    conditions.push({
      OR: SEARCH_FIELDS.map((field) => ({
        [field]: { contains: query.q, mode: 'insensitive' },
      })),
    });
  }

  for (const field of TEXT_FILTER_FIELDS) {
    const values = query[field];
    if (values?.length) {
      conditions.push({ OR: values.map((v) => equalsIgnoringCase(field, v)) });
    }
  }

  for (const field of CONTAINS_FILTER_FIELDS) {
    const text = query[field];
    if (text)
      conditions.push({ [field]: { contains: text, mode: 'insensitive' } });
  }

  if (query.launchYearFrom !== undefined || query.launchYearTo !== undefined) {
    conditions.push({
      launchYear: { gte: query.launchYearFrom, lte: query.launchYearTo },
    });
  }

  if (!query.status?.length) {
    conditions.push({ NOT: equalsIgnoringCase('status', DISCONTINUED) });
  }

  if (query.certification?.length) {
    conditions.push({ certifications: { hasEvery: query.certification } });
  }

  return { AND: conditions };
}

/**
 * Builds the sort order: the requested column (unknown launch years last), then the
 * SKU as a stable tie-breaker.
 */
export function toProductOrderBy(
  sort: ProductSort,
): Prisma.ProductOrderByWithRelationInput[] {
  const direction = sort.startsWith('-') ? 'desc' : 'asc';
  const field = (sort.startsWith('-') ? sort.slice(1) : sort) as SortField;
  const primary: Prisma.ProductOrderByWithRelationInput =
    field === 'launchYear'
      ? { launchYear: { sort: direction, nulls: 'last' } } // unknown year never ranks first
      : { [field]: direction };
  // SKU tie-breaker: a stable order makes pages and shared links reproducible.
  return [primary, { sku: 'asc' }];
}

/**
 * De-duplicates filter values that differ only in case or surrounding whitespace.
 * The first occurrence wins, so pass values ordered by frequency to show the most
 * common spelling. Result is sorted alphabetically.
 */
export function uniqueIgnoringCase(values: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (key && !byKey.has(key)) byKey.set(key, value.trim());
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}
