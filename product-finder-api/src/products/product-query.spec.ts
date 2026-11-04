import { plainToInstance } from 'class-transformer';
import { ProductQueryDto } from './product-query.dto';
import {
  toProductOrderBy,
  toProductWhere,
  uniqueIgnoringCase,
} from './product-query';

/** Builds the DTO the way ValidationPipe does: from raw query params, with defaults applied. */
const query = (params: Record<string, unknown> = {}) =>
  plainToInstance(ProductQueryDto, params);

/** Always the first condition: products missing from the latest export are never listed. */
const LISTED_ONLY = { delistedAt: null };

const HIDE_DISCONTINUED = {
  NOT: { status: { equals: 'Discontinued', mode: 'insensitive' } },
};

describe('toProductWhere', () => {
  it('hides discontinued products by default', () => {
    expect(toProductWhere(query())).toEqual({
      AND: [LISTED_ONLY, HIDE_DISCONTINUED],
    });
  });

  it('searches name, SKU and chemical name, case-insensitively', () => {
    expect(toProductWhere(query({ q: 'polysorbate' })).AND).toContainEqual({
      OR: [
        { name: { contains: 'polysorbate', mode: 'insensitive' } },
        { sku: { contains: 'polysorbate', mode: 'insensitive' } },
        { chemicalName: { contains: 'polysorbate', mode: 'insensitive' } },
      ],
    });
  });

  it('ORs values within a filter and ANDs across filters', () => {
    const where = toProductWhere(
      query({ region: ['EMEA', 'Global'], function: 'Surfactant' }),
    );
    expect(where.AND).toContainEqual({
      OR: [
        { region: { equals: 'EMEA', mode: 'insensitive' } },
        { region: { equals: 'Global', mode: 'insensitive' } },
      ],
    });
    expect(where.AND).toContainEqual({
      OR: [{ function: { equals: 'Surfactant', mode: 'insensitive' } }],
    });
  });

  it('excludes delisted products even when filtering by status', () => {
    expect(
      toProductWhere(query({ status: 'Discontinued' })).AND,
    ).toContainEqual(LISTED_ONLY);
  });

  it('shows discontinued products only when status is filtered explicitly', () => {
    const where = toProductWhere(query({ status: 'Discontinued' }));
    expect(where.AND).not.toContainEqual(HIDE_DISCONTINUED);
    expect(where.AND).toContainEqual({
      OR: [{ status: { equals: 'Discontinued', mode: 'insensitive' } }],
    });
  });

  it('requires every selected certification', () => {
    expect(
      toProductWhere(query({ certification: ['Vegan', 'Halal'] })).AND,
    ).toContainEqual({ certifications: { hasEvery: ['Vegan', 'Halal'] } });
  });

  it('matches name and description by "contains"', () => {
    const where = toProductWhere(
      query({ name: 'quorin', description: 'biodegradable' }),
    );
    expect(where.AND).toContainEqual({
      name: { contains: 'quorin', mode: 'insensitive' },
    });
    expect(where.AND).toContainEqual({
      description: { contains: 'biodegradable', mode: 'insensitive' },
    });
  });

  it('filters chemical names like the other value filters', () => {
    expect(
      toProductWhere(query({ chemicalName: 'Polysorbate 80' })).AND,
    ).toContainEqual({
      OR: [{ chemicalName: { equals: 'Polysorbate 80', mode: 'insensitive' } }],
    });
  });

  it('filters a launch year range, open on either side', () => {
    expect(
      toProductWhere(query({ launchYearFrom: '2015', launchYearTo: '2020' }))
        .AND,
    ).toContainEqual({ launchYear: { gte: 2015, lte: 2020 } });
    expect(
      toProductWhere(query({ launchYearFrom: '2015' })).AND,
    ).toContainEqual({
      launchYear: { gte: 2015, lte: undefined },
    });
  });

  it('ignores a blank search term', () => {
    expect(toProductWhere(query({ q: '   ' }))).toEqual({
      AND: [LISTED_ONLY, HIDE_DISCONTINUED],
    });
  });
});

describe('toProductOrderBy', () => {
  it('sorts by name with a SKU tie-breaker by default', () => {
    expect(toProductOrderBy(query().sort)).toEqual([
      { name: 'asc' },
      { sku: 'asc' },
    ]);
  });

  it.each([
    'sku',
    'chemicalName',
    'function',
    'applicationArea',
    'region',
    'status',
  ] as const)('sorts by %s in both directions', (field) => {
    expect(toProductOrderBy(field)).toEqual([
      { [field]: 'asc' },
      { sku: 'asc' },
    ]);
    expect(toProductOrderBy(`-${field}`)).toEqual([
      { [field]: 'desc' },
      { sku: 'asc' },
    ]);
  });

  it('sorts descending and keeps unknown launch years last', () => {
    expect(toProductOrderBy('-launchYear')).toEqual([
      { launchYear: { sort: 'desc', nulls: 'last' } },
      { sku: 'asc' },
    ]);
  });
});

describe('uniqueIgnoringCase', () => {
  it('merges spelling variants, keeping the first (most frequent) one', () => {
    expect(
      uniqueIgnoringCase(['Active', 'active', ' EMEA ', 'ACTIVE', 'EMEA']),
    ).toEqual(['Active', 'EMEA']);
  });
});
