import { convertToParamMap } from '@angular/router';
import {
  countActiveFilters,
  emptyFilters,
  parseYear,
  ProductSearch,
  searchFromParams,
  searchToParams,
} from './product-search';

const defaults: ProductSearch = {
  q: '',
  name: '',
  description: '',
  launchYearFrom: null,
  launchYearTo: null,
  filters: emptyFilters(),
  sortField: 'name',
  sortDirection: 'asc',
  page: 1,
};

describe('product search ⇄ URL', () => {
  it('reads defaults from an empty URL and writes nothing back (short links)', () => {
    expect(searchFromParams(convertToParamMap({}))).toEqual(defaults);
    expect(searchToParams(defaults)).toEqual({});
  });

  it('round-trips a full search, with repeated params for multiple values', () => {
    const search: ProductSearch = {
      ...defaults,
      q: 'polysorbate',
      name: 'quorin',
      description: 'biodegradable',
      launchYearFrom: 2010,
      launchYearTo: 2020,
      filters: { ...emptyFilters(), region: ['EMEA', 'Global'], chemicalName: ['Lecithin'] },
      sortField: 'chemicalName',
      sortDirection: 'desc',
      page: 3,
    };
    const params = searchToParams(search);
    expect(params).toEqual({
      q: 'polysorbate',
      name: 'quorin',
      description: 'biodegradable',
      launchYearFrom: '2010',
      launchYearTo: '2020',
      region: ['EMEA', 'Global'],
      chemicalName: ['Lecithin'],
      sort: '-chemicalName',
      page: '3',
    });
    expect(searchFromParams(convertToParamMap(params))).toEqual(search);
  });

  it('writes a descending default field as "-name"', () => {
    expect(searchToParams({ ...defaults, sortDirection: 'desc' })).toEqual({ sort: '-name' });
  });

  it('keeps typed text as is (a trailing space while typing), but leaves blank text out', () => {
    expect(searchFromParams(convertToParamMap({ q: 'quorin ' })).q).toBe('quorin ');
    expect(searchToParams({ ...defaults, q: '   ' })).toEqual({});
  });

  it.each([
    ['an unknown sort', { sort: 'price' }],
    ['sorting by description', { sort: '-description' }],
    ['a non-numeric page', { page: 'abc' }],
    ['page 0', { page: '0' }],
    ['an invalid year', { launchYearFrom: '20' }],
  ])('falls back to defaults for %s (hand-edited links)', (_, params) => {
    expect(searchFromParams(convertToParamMap(params))).toEqual(defaults);
  });

  it('counts active filters (values, text filters and years, not the quick search)', () => {
    expect(
      countActiveFilters({
        ...defaults,
        q: 'ignored',
        name: 'x',
        launchYearTo: 2020,
        filters: { ...emptyFilters(), region: ['EMEA', 'Global'] },
      }),
    ).toBe(4);
  });
});

describe('parseYear', () => {
  it.each([
    ['2015', 2015],
    [' 2015 ', 2015],
    ['20', null],
    ['1800', null],
    ['', null],
    [null, null],
  ])('parses %j as %j', (input, year) => {
    expect(parseYear(input)).toBe(year);
  });
});
