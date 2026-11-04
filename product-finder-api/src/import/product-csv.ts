/** Shape of the PIM export (data/products.csv) and of the import's intermediate results. */

/** Required columns of the PIM export. Extra columns are ignored. */
export const CSV_COLUMNS = [
  'sku',
  'name',
  'chemical_name',
  'function',
  'application_area',
  'region',
  'certifications',
  'status',
  'launch_year',
  'description',
] as const;

/** One of the required column names. */
export type CsvColumn = (typeof CSV_COLUMNS)[number];

/** One data row exactly as exported (untrimmed), with its line number in the file. */
export interface CsvRecord {
  line: number;
  values: Record<CsvColumn, string>;
}

/** Why a row was quarantined instead of imported (DECISIONS §2.1). */
export type RejectReason = 'DUPLICATE_SKU' | 'MISSING_SKU' | 'MISSING_NAME';

/** A rejected row together with the reason it was rejected. */
export interface QuarantinedRecord {
  record: CsvRecord;
  reason: RejectReason;
}

/** A validated, cleaned product, ready to be upserted. */
export interface ProductInput {
  sku: string;
  name: string;
  chemicalName: string;
  function: string;
  applicationArea: string;
  region: string;
  certifications: string[];
  status: string;
  launchYear: number | null;
  description: string;
}

/** Result of `partitionRecords`: rows to import and rejected rows, both as exported. */
export interface PartitionResult {
  accepted: CsvRecord[];
  quarantined: QuarantinedRecord[];
}

/** Result of `validateRows`: what to import, what to quarantine, what to warn about. */
export interface ValidationResult {
  valid: ProductInput[];
  quarantined: QuarantinedRecord[];
  /** Non-blocking data issues, e.g. an unparseable launch year. */
  warnings: string[];
}
