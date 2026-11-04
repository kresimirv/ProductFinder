import { PaginationQueryDto } from './pagination.dto';

/** Response envelope for every list endpoint. */
export interface Paginated<T> {
  items: T[];
  /** Number of matching items across all pages. */
  total: number;
  page: number;
  pageSize: number;
}

/** Translates page-based pagination into Prisma's `skip` / `take`. */
export function toSkipTake({ page, pageSize }: PaginationQueryDto): {
  skip: number;
  take: number;
} {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
