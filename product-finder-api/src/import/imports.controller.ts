import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Paginated } from '../common/pagination';
import { PaginationQueryDto } from '../common/pagination.dto';
import { ImportRun } from '../generated/prisma/client';
import { ImportRunsService } from './import-runs.service';

/**
 * Read-only import status under `/api/v1/imports`: one entry per run of the import
 * command. There's deliberately no endpoint to *start* an import: without
 * authentication, anyone could trigger one.
 */
@ApiTags('imports')
@Controller('imports')
export class ImportsController {
  constructor(private readonly importRuns: ImportRunsService) {}

  /** Import runs, newest first. */
  @Get()
  list(@Query() page: PaginationQueryDto): Promise<Paginated<ImportRun>> {
    return this.importRuns.list(page);
  }

  /** One import run (`finishedAt: null` means it failed or is still running). */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ImportRun> {
    return this.importRuns.findById(id);
  }
}
