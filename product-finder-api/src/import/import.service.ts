import { Injectable } from '@nestjs/common';
import { basename, resolve } from 'node:path';
import {
  importFilesFor,
  readProductCsv,
  removeImportFiles,
  writeErrorCsv,
  writeImportedCsv,
} from './csv-files';
import { ProductImportRepository } from './product-import.repository';
import { partitionRecords, validateRows } from './validate-rows';

/** Outcome of one import run; the CLI logs it as a one-line summary. */
export interface ImportSummary {
  /** Data rows in the input CSV. */
  totalRows: number;
  /** Unique, complete rows written to the imported file. */
  importedRows: number;
  /** Rejected rows written to the error file. */
  errorRows: number;
  importedFile: string;
  errorFile: string;
  /** Inserted + updated + relisted. */
  processedRows: number;
  /** Listed products whose SKU is missing from this export (now hidden from search). */
  delistedRows: number;
  /** Imported rows that already matched the DB. */
  unchanged: number;
  warnings: string[];
}

/**
 * Imports a PIM export:
 * 1. read the export (it is never modified);
 * 2. split it into `products_imported_<date>.csv` (unique SKUs) and
 *    `products_error_<date>.csv` (duplicates, missing SKU or name);
 * 3. bulk-import the imported file;
 * 4. delist products whose SKU is no longer in the export.
 * Products are the PIM's reference data; reviews are never touched.
 */
@Injectable()
export class ImportService {
  constructor(private readonly repository: ProductImportRepository) {}

  /**
   * Imports one CSV file end to end.
   * @param filePath path to the PIM export; relative paths resolve against the working directory.
   * @param now the run's date, used in the file names (injectable for tests).
   * @returns the counts and file paths for the summary log.
   * @throws Error if a file can't be read or written, a required column is missing,
   *         a row is malformed, or the DB write fails. No products are changed then.
   */
  async importFile(filePath: string, now = new Date()): Promise<ImportSummary> {
    const inputPath = resolve(filePath);
    // Recorded first, so a run that fails later stays visible (finished_at = NULL).
    const runId = await this.repository.startRun(inputPath);

    // Split the export into the day's two files. Files from an earlier run today
    // are removed first, so the directory only ever holds this run's result.
    const records = await readProductCsv(inputPath);
    const { accepted, quarantined } = partitionRecords(records);
    const files = importFilesFor(inputPath, now);
    await removeImportFiles(files);
    await writeErrorCsv(files.errorFile, quarantined);
    await writeImportedCsv(files.importedFile, accepted);

    // The bulk import reads the imported file, so what lands in the DB is exactly
    // what that file contains (values are cleaned while mapping).
    const { valid, warnings } = validateRows(
      await readProductCsv(files.importedFile),
    );
    // Every SKU in the export, rejected rows included, counts as "still in the PIM".
    const exportSkus = [
      ...new Set(records.map((r) => r.values.sku.trim()).filter(Boolean)),
    ];
    const { processedRows, delistedRows } =
      await this.repository.upsertProductsAndFinishRun(
        runId,
        records.length,
        valid,
        exportSkus,
      );

    return {
      totalRows: records.length,
      importedRows: valid.length,
      errorRows: quarantined.length,
      ...files,
      processedRows,
      delistedRows,
      unchanged: valid.length - processedRows,
      // Line numbers refer to the imported file, so say which file they're in.
      warnings: warnings.map((w) => `${basename(files.importedFile)} ${w}`),
    };
  }
}
