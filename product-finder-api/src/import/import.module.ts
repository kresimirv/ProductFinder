import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ImportRunsService } from './import-runs.service';
import { ImportService } from './import.service';
import { ImportsController } from './imports.controller';
import { ProductImportRepository } from './product-import.repository';

/**
 * CSV import of the PIM export. The CLI (import.main.ts) boots it without HTTP; in
 * the API it also serves the read-only import status endpoints.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ImportsController],
  providers: [ImportService, ProductImportRepository, ImportRunsService],
  exports: [ImportService],
})
export class ImportModule {}
