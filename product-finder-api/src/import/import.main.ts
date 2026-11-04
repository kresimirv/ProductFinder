/**
 * CLI: `npm run import -- <path/to/products.csv>`
 *
 * Boots the import module as a Nest application context (no HTTP server), so it
 * reuses the API's Prisma setup. Exit code 0 = import completed (rejected rows are
 * reported, not fatal); 1 = nothing imported (bad file, bad header, DB error).
 */
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ImportModule } from './import.module';
import { ImportService } from './import.service';

const logger = new Logger('ProductImport');

/**
 * Runs one import and maps the outcome to an exit code.
 * @param filePath CSV path from the command line (`process.argv[2]`).
 * @returns 0 when the import completed, 1 when nothing was imported.
 */
async function main(filePath: string | undefined): Promise<number> {
  if (!filePath) {
    logger.error('Usage: npm run import -- <path/to/products.csv>');
    return 1;
  }

  // Quiet while Nest boots (no module-loading noise), then show our own log lines too.
  const app = await NestFactory.createApplicationContext(ImportModule, {
    logger: ['error', 'warn'],
  });
  app.useLogger(['log', 'warn', 'error']);
  try {
    const s = await app.get(ImportService).importFile(filePath);
    s.warnings.forEach((warning) => logger.warn(warning));
    logger.log(
      `${s.totalRows} rows: ${s.importedRows} imported (${s.importedFile}), ` +
        `${s.errorRows} rejected (${s.errorFile}). ` +
        `${s.processedRows} inserted/updated, ${s.unchanged} unchanged, ${s.delistedRows} delisted, ` +
        `${s.warnings.length} warning(s).`,
    );
    return 0;
  } catch (error) {
    logger.error(
      `Import failed, nothing was imported: ${(error as Error).message}`,
    );
    return 1;
  } finally {
    await app.close();
  }
}

void main(process.argv[2]).then((code) => {
  process.exitCode = code;
});
