/** File I/O of the import: reading the PIM export and writing the imported and error files. */
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { CSV_COLUMNS, CsvRecord, QuarantinedRecord } from './product-csv';
import { assertHeader } from './validate-rows';

/** A record as returned by csv-parse with `info: true`. */
type ParsedRow = { record: CsvRecord['values']; info: { lines: number } };

/**
 * Parses the whole export (RFC 4180: quoted fields, embedded commas, `""` escapes).
 * Reading everything first is needed anyway to detect duplicate SKUs across the
 * file, and it's fine at the expected size (~50k rows, a few MB).
 *
 * @throws Error if the header lacks a required column or a row is malformed.
 */
export async function readProductCsv(path: string): Promise<CsvRecord[]> {
  const rows = parse<ParsedRow>(await readFile(path), {
    bom: true, // exports saved by Excel start with a byte-order mark
    columns: (header: string[]) => {
      assertHeader(header);
      return header.map((column) => column.trim());
    },
    skip_empty_lines: true,
    info: true,
  });
  return rows.map(({ record, info }) => ({ line: info.lines, values: record }));
}

/** The two files an import writes next to the input file. */
export interface ImportFiles {
  /** Unique, complete rows (as exported); the bulk import reads this file. */
  importedFile: string;
  /** Duplicate SKUs and rows missing `sku`/`name` (as exported), with `reject_reason`. */
  errorFile: string;
}

/**
 * Paths of the day's import files, next to the input so the PM finds them with the
 * export: `products_imported_<YYYY-MM-DD>.csv` and `products_error_<YYYY-MM-DD>.csv`.
 * The date is the server's local date.
 */
export function importFilesFor(inputPath: string, date: Date): ImportFiles {
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  const dir = dirname(inputPath);
  return {
    importedFile: join(dir, `products_imported_${day}.csv`),
    errorFile: join(dir, `products_error_${day}.csv`),
  };
}

/** Removes the day's files from an earlier run, so a same-day re-run starts clean. */
export async function removeImportFiles(files: ImportFiles): Promise<void> {
  await Promise.all(
    [files.importedFile, files.errorFile].map((path) =>
      rm(path, { force: true }),
    ),
  );
}

/** Writes the accepted rows unchanged (as exported), with the standard header. */
export async function writeImportedCsv(
  path: string,
  records: CsvRecord[],
): Promise<void> {
  const csv = stringify(
    records.map((record) => record.values),
    { header: true, columns: [...CSV_COLUMNS] },
  );
  await writeFile(path, csv);
}

/**
 * Writes rejected rows unchanged (as exported) plus a `reject_reason` column.
 * The file is always written, with only the header if nothing was rejected.
 */
export async function writeErrorCsv(
  path: string,
  quarantined: QuarantinedRecord[],
): Promise<void> {
  const csv = stringify(
    quarantined.map(({ record, reason }) => ({
      ...record.values,
      reject_reason: reason,
    })),
    { header: true, columns: [...CSV_COLUMNS, 'reject_reason'] },
  );
  await writeFile(path, csv);
}
