/**
 * Pure validation and mapping of CSV records. There's no I/O, so every import rule
 * is unit-tested in validate-rows.spec.ts.
 */
import {
  CSV_COLUMNS,
  CsvRecord,
  PartitionResult,
  ProductInput,
  QuarantinedRecord,
  ValidationResult,
} from './product-csv';

/** @throws Error listing the missing columns, so a wrong file fails before anything is written. */
export function assertHeader(header: string[]): void {
  const present = new Set(header.map((column) => column.trim()));
  const missing = CSV_COLUMNS.filter((column) => !present.has(column));
  if (missing.length) {
    throw new Error(`CSV is missing required column(s): ${missing.join(', ')}`);
  }
}

/**
 * Splits records into importable rows and rejected rows, both kept as exported.
 *
 * - **DUPLICATE_SKU:** *every* row of an SKU that occurs more than once. Choosing a
 *   winner would mean guessing business data (e.g. P-10151 is both Active and
 *   Discontinued).
 * - **MISSING_SKU / MISSING_NAME:** the product can't be matched or shown.
 *
 * SKUs and names are compared trimmed, so whitespace can't hide a duplicate.
 */
export function partitionRecords(records: CsvRecord[]): PartitionResult {
  const skuCounts = new Map<string, number>();
  for (const { values } of records) {
    const sku = values.sku.trim();
    skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1);
  }

  const accepted: CsvRecord[] = [];
  const quarantined: QuarantinedRecord[] = [];
  for (const record of records) {
    const sku = record.values.sku.trim();
    if (!sku) {
      quarantined.push({ record, reason: 'MISSING_SKU' });
    } else if (skuCounts.get(sku)! > 1) {
      quarantined.push({ record, reason: 'DUPLICATE_SKU' });
    } else if (!record.values.name.trim()) {
      quarantined.push({ record, reason: 'MISSING_NAME' });
    } else {
      accepted.push(record);
    }
  }
  return { accepted, quarantined };
}

/**
 * Partitions the records ({@link partitionRecords}) and maps the accepted ones to
 * cleaned products ({@link toProductInput}).
 */
export function validateRows(records: CsvRecord[]): ValidationResult {
  const { accepted, quarantined } = partitionRecords(records);
  const warnings: string[] = [];
  const valid = accepted.map((record) => toProductInput(record, warnings));
  return { valid, quarantined, warnings };
}

/** Maps a record to a product: trims every value, splits certifications, parses the year. */
export function toProductInput(
  { line, values }: CsvRecord,
  warnings: string[],
): ProductInput {
  const v = (column: keyof CsvRecord['values']) => values[column].trim();
  return {
    sku: v('sku'),
    name: v('name'),
    chemicalName: v('chemical_name'),
    function: v('function'),
    applicationArea: v('application_area'),
    region: v('region'),
    certifications: v('certifications')
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean),
    status: v('status'), // stored as exported (DECISIONS §4)
    launchYear: parseLaunchYear(v('launch_year'), line, v('sku'), warnings),
    description: v('description'),
  };
}

/** A four-digit year, or `null` (with a warning) for values like '' or 'n/a'. */
function parseLaunchYear(
  raw: string,
  line: number,
  sku: string,
  warnings: string[],
): number | null {
  if (/^\d{4}$/.test(raw)) return Number(raw);
  warnings.push(
    `line ${line} (${sku}): launch_year "${raw}" is not a year, stored as empty`,
  );
  return null;
}
