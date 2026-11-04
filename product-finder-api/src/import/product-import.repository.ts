import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductInput } from './product-csv';

/** Rows per INSERT statement: keeps statements a bounded size at 50k products. */
const BATCH_SIZE = 1000;

/** Generous limit for one import transaction (Prisma's default is 5 s). */
const TRANSACTION_TIMEOUT_MS = 10 * 60_000;

/**
 * Database writes of the import. This is the only place with raw SQL, because Prisma
 * has no bulk upsert and a per-row `upsert` would mean 50k round-trips.
 */
@Injectable()
export class ProductImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records the start of a run *outside* the import transaction, so a failed run
   * stays visible (`finished_at` is NULL).
   */
  async startRun(fileName: string): Promise<string> {
    const run = await this.prisma.importRun.create({
      data: { fileName },
      select: { id: true },
    });
    return run.id;
  }

  /**
   * Upserts all products, delists the ones missing from the export, and completes
   * the run, all in **one transaction**: customers see the old catalogue or the
   * new one, never a mix. An advisory lock makes concurrent imports (e.g. nightly
   * job + manual run) wait for each other.
   *
   * @param products valid rows to upsert (from the imported file).
   * @param exportSkus every SKU in the export, rejected rows included: those
   *        products still exist in the PIM, so they stay listed.
   * @returns processed rows (inserted + updated + relisted; unchanged rows don't
   *          count, so a re-run returns 0) and newly delisted rows.
   */
  async upsertProductsAndFinishRun(
    runId: string,
    totalRows: number,
    products: ProductInput[],
    exportSkus: string[],
  ): Promise<{ processedRows: number; delistedRows: number }> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('product_import'))`;

        let processedRows = 0;
        for (let i = 0; i < products.length; i += BATCH_SIZE) {
          const batch = JSON.stringify(
            products.slice(i, i + BATCH_SIZE).map(toColumns),
          );
          processedRows += await tx.$executeRaw`
            INSERT INTO product (id, sku, name, chemical_name, "function", application_area,
                                 region, certifications, status, launch_year, description, updated_at)
            SELECT uuidv7(), r.sku, r.name, r.chemical_name, r."function", r.application_area,
                   r.region, r.certifications, r.status, r.launch_year, r.description, now()
            FROM jsonb_to_recordset(${batch}::jsonb) AS r(
              sku text, name text, chemical_name text, "function" text, application_area text,
              region text, certifications text[], status text, launch_year smallint, description text)
            ON CONFLICT (sku) DO UPDATE SET
              name = EXCLUDED.name,
              chemical_name = EXCLUDED.chemical_name,
              "function" = EXCLUDED."function",
              application_area = EXCLUDED.application_area,
              region = EXCLUDED.region,
              certifications = EXCLUDED.certifications,
              status = EXCLUDED.status,
              launch_year = EXCLUDED.launch_year,
              description = EXCLUDED.description,
              delisted_at = NULL, -- back in the export: listed again
              updated_at = now()
            -- Skip unchanged rows: they aren't counted, and updated_at keeps meaning "last real change".
            WHERE (product.name, product.chemical_name, product."function", product.application_area,
                   product.region, product.certifications, product.status, product.launch_year,
                   product.description, product.delisted_at)
                  IS DISTINCT FROM
                  (EXCLUDED.name, EXCLUDED.chemical_name, EXCLUDED."function", EXCLUDED.application_area,
                   EXCLUDED.region, EXCLUDED.certifications, EXCLUDED.status, EXCLUDED.launch_year,
                   EXCLUDED.description, EXCLUDED.delisted_at) -- EXCLUDED.delisted_at is always NULL
          `;
        }

        // Products the PIM no longer exports are delisted, not deleted: their reviews
        // and shared links survive, and they come back if the SKU reappears.
        const delistedRows = await tx.$executeRaw`
          UPDATE product SET delisted_at = now(), updated_at = now()
          WHERE delisted_at IS NULL AND sku <> ALL(${exportSkus}::text[])`;

        await tx.importRun.update({
          where: { id: runId },
          data: {
            totalRows,
            processedRows,
            delistedRows,
            finishedAt: new Date(),
          },
        });
        return { processedRows, delistedRows };
      },
      { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_TIMEOUT_MS },
    );
  }
}

/** JSON keys must match the column list of `jsonb_to_recordset` above. */
function toColumns(p: ProductInput) {
  return {
    sku: p.sku,
    name: p.name,
    chemical_name: p.chemicalName,
    function: p.function,
    application_area: p.applicationArea,
    region: p.region,
    certifications: p.certifications,
    status: p.status,
    launch_year: p.launchYear,
    description: p.description,
  };
}
