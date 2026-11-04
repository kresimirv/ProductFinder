import { Injectable, NotFoundException } from '@nestjs/common';
import { Paginated, toSkipTake } from '../common/pagination';
import { PaginationQueryDto } from '../common/pagination.dto';
import { ImportRun } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Read access to the `import_run` audit table. */
@Injectable()
export class ImportRunsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Import runs, newest first. Unfinished runs (`finishedAt: null`) failed or are still running. */
  async list(page: PaginationQueryDto): Promise<Paginated<ImportRun>> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.importRun.findMany({
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(page),
      }),
      this.prisma.importRun.count(),
    ]);
    return { items, total, page: page.page, pageSize: page.pageSize };
  }

  /** @throws NotFoundException when no run has this id. */
  async findById(id: string): Promise<ImportRun> {
    const run = await this.prisma.importRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException(`Import run ${id} not found`);
    return run;
  }
}
