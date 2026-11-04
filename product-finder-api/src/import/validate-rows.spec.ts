import { CsvRecord } from './product-csv';
import { importFilesFor } from './csv-files';
import { assertHeader, partitionRecords, validateRows } from './validate-rows';

let nextLine = 2;
/** A valid CSV record; override columns as needed. */
const record = (values: Partial<CsvRecord['values']> = {}): CsvRecord => ({
  line: nextLine++,
  values: {
    sku: 'P-1',
    name: 'Quorin SF 470',
    chemical_name: 'Sodium Laureth Sulfate',
    function: 'Surfactant',
    application_area: 'Home Care',
    region: 'EMEA',
    certifications: 'Kosher|RSPO Mass Balance',
    status: 'Active',
    launch_year: '2012',
    description: 'Surfactant for home care.',
    ...values,
  },
});

describe('assertHeader', () => {
  it('accepts the PIM header in any order, with extra columns and stray spaces', () => {
    expect(() =>
      assertHeader([
        'description',
        ' sku ',
        'name',
        'chemical_name',
        'function',
        'application_area',
        'region',
        'certifications',
        'status',
        'launch_year',
        'extra',
      ]),
    ).not.toThrow();
  });

  it('names the missing columns', () => {
    expect(() => assertHeader(['sku', 'name'])).toThrow(
      /missing required column\(s\): chemical_name, function/,
    );
  });
});

describe('validateRows', () => {
  it('maps a valid row: trims values, splits certifications, parses the year', () => {
    const { valid, quarantined, warnings } = validateRows([
      record({
        name: '  Puraxin SF 120 ',
        region: ' EMEA ',
        certifications: ' Kosher | Vegan ',
      }),
    ]);
    expect(quarantined).toEqual([]);
    expect(warnings).toEqual([]);
    expect(valid).toEqual([
      {
        sku: 'P-1',
        name: 'Puraxin SF 120',
        chemicalName: 'Sodium Laureth Sulfate',
        function: 'Surfactant',
        applicationArea: 'Home Care',
        region: 'EMEA',
        certifications: ['Kosher', 'Vegan'],
        status: 'Active',
        launchYear: 2012,
        description: 'Surfactant for home care.',
      },
    ]);
  });

  it('keeps status as exported (only trimmed)', () => {
    expect(validateRows([record({ status: ' ACTIVE ' })]).valid[0].status).toBe(
      'ACTIVE',
    );
  });

  it('maps empty certifications to an empty list', () => {
    expect(
      validateRows([record({ certifications: '' })]).valid[0].certifications,
    ).toEqual([]);
  });

  it.each(['', 'n/a', '20x5'])(
    'stores launch year %j as null with a warning',
    (year) => {
      const { valid, warnings } = validateRows([
        record({ sku: 'P-10105', launch_year: year }),
      ]);
      expect(valid[0].launchYear).toBeNull();
      expect(warnings).toEqual([expect.stringContaining('P-10105')]);
    },
  );

  it('quarantines every row of a duplicated SKU, even identical ones', () => {
    const first = record({ sku: 'P-10151', status: 'Active' });
    const second = record({ sku: ' P-10151', status: 'Discontinued' }); // whitespace doesn't hide a duplicate
    const other = record({ sku: 'P-2' });
    const { valid, quarantined } = validateRows([first, second, other]);
    expect(valid.map((p) => p.sku)).toEqual(['P-2']);
    expect(quarantined).toEqual([
      { record: first, reason: 'DUPLICATE_SKU' },
      { record: second, reason: 'DUPLICATE_SKU' },
    ]);
  });

  it.each([
    ['MISSING_SKU', { sku: '  ' }],
    ['MISSING_NAME', { name: '' }],
  ])('quarantines a row as %s', (reason, values) => {
    const bad = record(values);
    const { valid, quarantined } = validateRows([bad]);
    expect(valid).toEqual([]);
    expect(quarantined).toEqual([{ record: bad, reason }]);
  });
});

describe('partitionRecords', () => {
  it('keeps accepted and rejected rows exactly as exported', () => {
    const ok = record({ sku: 'P-7', region: ' EMEA ' });
    const nameless = record({ sku: 'P-8', name: ' ' });
    expect(partitionRecords([ok, nameless])).toEqual({
      accepted: [ok],
      quarantined: [{ record: nameless, reason: 'MISSING_NAME' }],
    });
  });
});

describe('importFilesFor', () => {
  it("names the day's files next to the input, with a zero-padded YYYY-MM-DD date", () => {
    expect(importFilesFor('/data/products.csv', new Date(2026, 0, 5))).toEqual({
      importedFile: '/data/products_imported_2026-01-05.csv',
      errorFile: '/data/products_error_2026-01-05.csv',
    });
  });
});
