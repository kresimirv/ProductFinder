import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** Shared `page` / `pageSize` query parameters for every list endpoint. */
export class PaginationQueryDto {
  /**
   * 1-based page number.
   * @example 1
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /**
   * Items per page. Capped so a single request can't pull the whole catalogue.
   * @example 20
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
