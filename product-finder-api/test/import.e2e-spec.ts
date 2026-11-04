import { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  copyFile,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ImportModule } from '../src/import/import.module';
import { ImportService } from '../src/import/import.service';
import { PrismaService } from '../src/prisma/prisma.service';

/** A fixed run date, so the day's file names are predictable. */
const RUN_DATE = new Date(2026, 10, 3); // 3 Nov 2026, local time
const IMPORTED_FILE = 'products_imported_2026-11-03.csv';
const ERROR_FILE = 'products_error_2026-11-03.csv';

/** The unmodified sample export from the brief. */
const PIM_EXPORT = join(__dirname, '../../data/products.csv');

describe('Product import (e2e)', () => {
  let app: INestApplicationContext;
  let importer: ImportService;
  let prisma: PrismaService;
  let workDir: string;
  let csvPath: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ImportModule],
    }).compile();
    app = await moduleRef.init();
    importer = app.get(ImportService);
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.review.deleteMany();
    await prisma.product.deleteMany();
    await prisma.importRun.deleteMany();
    // Work on a copy: the quarantine file is written next to the input.
    workDir = await mkdtemp(join(tmpdir(), 'product-import-'));
    csvPath = join(workDir, 'products.csv');
    await copyFile(PIM_EXPORT, csvPath);
  });

  afterEach(() => rm(workDir, { recursive: true, force: true }));
  afterAll(() => app.close());

  it('imports the PIM export into an empty database and writes the error file', async () => {
    const summary = await importer.importFile(csvPath, RUN_DATE);

    expect(summary).toMatchObject({
      totalRows: 202,
      importedRows: 197,
      errorRows: 5,
      processedRows: 197,
      unchanged: 0,
    });
    expect(summary.warnings).toHaveLength(2); // P-10091 '' and P-10105 'n/a'
    expect(await prisma.product.count()).toBe(197);

    const quarantine = await readFile(join(workDir, ERROR_FILE), 'utf8');
    const lines = quarantine.trim().split('\n');
    expect(lines[0]).toMatch(/^sku,name,.*,description,reject_reason$/);
    expect(
      lines.slice(1).map((l) => `${l.split(',')[0]} ${l.split(',').at(-1)}`),
    ).toEqual([
      // in file order: lines 14, 99, 121, 153, 203
      'P-10013 DUPLICATE_SKU',
      'P-10013 DUPLICATE_SKU',
      'P-10119 MISSING_NAME',
      'P-10151 DUPLICATE_SKU',
      'P-10151 DUPLICATE_SKU',
    ]);

    const run = await prisma.importRun.findFirstOrThrow();
    expect(run).toMatchObject({
      totalRows: 202,
      processedRows: 197,
      fileName: csvPath,
    });
    expect(run.finishedAt).toBeInstanceOf(Date);
  });

  it('cleans values: trims whitespace, splits certifications, nulls invalid years, keeps quoted text', async () => {
    await importer.importFile(csvPath, RUN_DATE);
    const bySku = (sku: string) =>
      prisma.product.findUniqueOrThrow({ where: { sku } });

    expect(await bySku('P-10002')).toMatchObject({
      certifications: ['Halal', 'RSPO Mass Balance', 'Vegan'],
    });
    expect(await bySku('P-10016')).toMatchObject({ region: 'EMEA' }); // ' EMEA ' in the CSV
    expect(
      await prisma.product.count({ where: { name: 'Puraxin SF 120' } }),
    ).toBe(1);
    expect(await bySku('P-10105')).toMatchObject({ launchYear: null }); // 'n/a'
    expect((await bySku('P-10132')).description).toContain('"high-solids"'); // "" escape
    expect(await bySku('P-10008')).toMatchObject({ status: 'active' }); // as exported
  });

  it('is idempotent: a second run changes nothing', async () => {
    await importer.importFile(csvPath, RUN_DATE);
    const before = await prisma.product.findMany({ orderBy: { sku: 'asc' } });

    const second = await importer.importFile(csvPath, RUN_DATE);

    expect(second).toMatchObject({ processedRows: 0, unchanged: 197 });
    expect(await prisma.product.findMany({ orderBy: { sku: 'asc' } })).toEqual(
      before,
    );
    expect(await prisma.importRun.count()).toBe(2);
  });

  it('updates changed products and keeps their reviews', async () => {
    await importer.importFile(csvPath, RUN_DATE);
    const product = await prisma.product.findUniqueOrThrow({
      where: { sku: 'P-10001' },
    });
    await prisma.review.create({
      data: {
        productId: product.id,
        rating: 5,
        body: 'Great',
        authorName: 'Ana',
      },
    });

    const csv = await readFile(csvPath, 'utf8');
    await writeFile(
      csvPath,
      csv.replace(/^(P-10001,.*),Active,2012,/m, '$1,Discontinued,2012,'),
    );
    const summary = await importer.importFile(csvPath, RUN_DATE);

    expect(summary).toMatchObject({ processedRows: 1, unchanged: 196 });
    const updated = await prisma.product.findUniqueOrThrow({
      where: { sku: 'P-10001' },
      include: { reviews: true },
    });
    expect(updated.id).toBe(product.id);
    expect(updated.status).toBe('Discontinued');
    expect(updated.reviews).toHaveLength(1);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      product.updatedAt.getTime(),
    );
  });

  it('leaves the export untouched and writes the unique rows, as exported, to the imported file', async () => {
    const original = await readFile(csvPath, 'utf8');
    await importer.importFile(csvPath, RUN_DATE);

    expect(await readFile(csvPath, 'utf8')).toBe(original);
    expect((await readdir(workDir)).sort()).toEqual([
      'products.csv',
      ERROR_FILE,
      IMPORTED_FILE,
    ]);

    const imported = (await readFile(join(workDir, IMPORTED_FILE), 'utf8'))
      .trim()
      .split('\n');
    expect(imported[0]).toBe(original.split('\n')[0]); // same header
    expect(imported).toHaveLength(1 + 197);
    const skus = imported.slice(1).map((line) => line.split(',')[0]);
    expect(new Set(skus).size).toBe(197);
    expect(skus).not.toContain('P-10013'); // duplicates and the nameless P-10119 are only in the error file
    expect(skus).not.toContain('P-10119');
    expect(imported).toContain(
      original.split('\n').find((l) => l.startsWith('P-10016,')),
    ); // " EMEA " kept as exported
  });

  it("removes the same day's files from an earlier run before importing", async () => {
    await writeFile(join(workDir, IMPORTED_FILE), 'stale');
    await writeFile(join(workDir, ERROR_FILE), 'stale');

    await importer.importFile(csvPath, RUN_DATE);

    expect(await readFile(join(workDir, IMPORTED_FILE), 'utf8')).toMatch(
      /^sku,name,/,
    );
    expect(await readFile(join(workDir, ERROR_FILE), 'utf8')).toMatch(
      /^sku,name,.*reject_reason/,
    );
  });

  it('names the files after the run date, so other days are kept', async () => {
    await importer.importFile(csvPath, RUN_DATE);
    await importer.importFile(csvPath, new Date(2026, 10, 4));
    expect((await readdir(workDir)).sort()).toEqual([
      'products.csv',
      ERROR_FILE,
      'products_error_2026-11-04.csv',
      IMPORTED_FILE,
      'products_imported_2026-11-04.csv',
    ]);
  });

  describe('delisting', () => {
    /** Rewrites the working CSV without the given SKU's row(s). */
    async function exportWithout(sku: string): Promise<void> {
      const lines = (await readFile(csvPath, 'utf8')).split('\n');
      await writeFile(
        csvPath,
        lines.filter((l) => !l.startsWith(`${sku},`)).join('\n'),
      );
    }

    it('delists a product missing from a newer export, keeps its reviews, and relists it when it returns', async () => {
      await importer.importFile(csvPath, RUN_DATE);
      const product = await prisma.product.findUniqueOrThrow({
        where: { sku: 'P-10001' },
      });
      await prisma.review.create({
        data: {
          productId: product.id,
          rating: 4,
          body: 'Good',
          authorName: 'Ana',
        },
      });
      const full = await readFile(csvPath, 'utf8');

      await exportWithout('P-10001');
      const removed = await importer.importFile(csvPath, RUN_DATE);

      expect(removed).toMatchObject({ delistedRows: 1, processedRows: 0 });
      const delisted = await prisma.product.findUniqueOrThrow({
        where: { sku: 'P-10001' },
        include: { reviews: true },
      });
      expect(delisted.delistedAt).toBeInstanceOf(Date);
      expect(delisted.reviews).toHaveLength(1);
      expect(
        await prisma.importRun.findFirstOrThrow({
          orderBy: { startedAt: 'desc' },
        }),
      ).toMatchObject({
        delistedRows: 1,
      });

      await writeFile(csvPath, full);
      const back = await importer.importFile(csvPath, RUN_DATE);
      expect(back).toMatchObject({ delistedRows: 0, processedRows: 1 }); // relisted counts as processed
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { sku: 'P-10001' } }))
          .delistedAt,
      ).toBeNull();
    });

    it('keeps a product listed while its SKU is only in the error file (still in the PIM)', async () => {
      await importer.importFile(csvPath, RUN_DATE);
      // A second P-10001 row turns it into a duplicate: rejected, but present in the export.
      const csv = await readFile(csvPath, 'utf8');
      const row = csv.split('\n').find((l) => l.startsWith('P-10001,'))!;
      await writeFile(csvPath, `${csv.trimEnd()}\n${row}\n`);

      const summary = await importer.importFile(csvPath, RUN_DATE);

      expect(summary).toMatchObject({ delistedRows: 0, errorRows: 7 });
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { sku: 'P-10001' } }))
          .delistedAt,
      ).toBeNull();
    });
  });

  it('writes a header-only error file when nothing is rejected', async () => {
    const header = (await readFile(csvPath, 'utf8')).split('\n')[0];
    await writeFile(
      csvPath,
      `${header}\nP-1,Solo,Water,Solvent,Coatings,EMEA,,Active,2020,Plain water.\n`,
    );
    await importer.importFile(csvPath, RUN_DATE);
    const quarantine = await readFile(join(workDir, ERROR_FILE), 'utf8');
    expect(quarantine.trim()).toBe(
      'sku,name,chemical_name,function,application_area,region,certifications,status,launch_year,description,reject_reason',
    );
  });

  it('rejects a file with missing columns and imports nothing', async () => {
    await writeFile(csvPath, 'sku,name\nP-1,Solo\n');

    await expect(importer.importFile(csvPath, RUN_DATE)).rejects.toThrow(
      /missing required column/,
    );

    expect(await prisma.product.count()).toBe(0);
    const run = await prisma.importRun.findFirstOrThrow();
    expect(run.finishedAt).toBeNull(); // the failed run stays visible
  });
});
