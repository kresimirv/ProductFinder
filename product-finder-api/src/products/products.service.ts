import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { Paginated, toSkipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { ProductQueryDto } from './product-query.dto';
import {
  TEXT_FILTER_FIELDS,
  TextFilterField,
  toProductOrderBy,
  toProductWhere,
  uniqueIgnoringCase,
} from './product-query';

/** Fields exposed by the API. The internal `id` is used for joins only and is never returned. */
const PRODUCT_FIELDS = {
  id: true,
  sku: true,
  name: true,
  chemicalName: true,
  function: true,
  applicationArea: true,
  region: true,
  certifications: true,
  status: true,
  launchYear: true,
  description: true,
  delistedAt: true, // null = listed; otherwise the detail page shows a banner
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_FIELDS }>;

/** Review statistics of one product. */
export interface RatingSummary {
  /** Average rating rounded to 2 decimals, or `null` when there are no reviews. */
  average: number | null;
  count: number;
}

/** A product as returned by the API: public fields plus its rating summary. */
export type ProductView = Omit<ProductRow, 'id'> & { rating: RatingSummary };

/** Response of `GET /products/filters`: the values each filter can offer. */
export type ProductFilterOptions = Record<TextFilterField, string[]> & {
  certification: string[];
  /** Range of known launch years, for the year filter; `null` when there are no products. */
  launchYear: { min: number | null; max: number | null };
};

/** DB column behind each filterable field, for the raw `GROUP BY` query. */
const COLUMN_OF: Record<TextFilterField, string> = {
  chemicalName: 'chemical_name',
  function: 'function',
  applicationArea: 'application_area',
  region: 'region',
  status: 'status',
};

const NO_RATINGS: RatingSummary = { average: null, count: 0 };

/** Catalogue read side: search, filter options and product detail. */
@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One page of products matching the query, with the total and rating summaries.
   * Page and count run in one transaction, so they always agree.
   */
  async list(query: ProductQueryDto): Promise<Paginated<ProductView>> {
    const where = toProductWhere(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: toProductOrderBy(query.sort),
        select: PRODUCT_FIELDS,
        ...toSkipTake(query),
      }),
      this.prisma.product.count({ where }),
    ]);
    const ratings = await this.ratingSummaries(rows.map((r) => r.id));
    return {
      items: rows.map((row) => toView(row, ratings)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** @throws NotFoundException when no product has this SKU. */
  async findBySku(sku: string): Promise<ProductView> {
    const row = await this.prisma.product.findUnique({
      where: { sku },
      select: PRODUCT_FIELDS,
    });
    if (!row) throw productNotFound(sku);
    return toView(row, await this.ratingSummaries([row.id]));
  }

  /**
   * Resolves a public SKU to the internal id that reviews reference.
   * @throws NotFoundException when no product has this SKU.
   */
  async findIdBySku(sku: string): Promise<string> {
    const row = await this.prisma.product.findUnique({
      where: { sku },
      select: { id: true },
    });
    if (!row) throw productNotFound(sku);
    return row.id;
  }

  /** Values the client can offer in its filter controls (listed products only). */
  async filterOptions(): Promise<ProductFilterOptions> {
    const [textOptions, certification, years] = await Promise.all([
      Promise.all(TEXT_FILTER_FIELDS.map((f) => this.distinctValues(f))),
      this.prisma.$queryRaw<{ value: string }[]>`
        SELECT DISTINCT unnest(certifications) AS value FROM product WHERE delisted_at IS NULL`,
      this.prisma.product.aggregate({
        where: { delistedAt: null },
        _min: { launchYear: true },
        _max: { launchYear: true },
      }),
    ]);
    return {
      ...(Object.fromEntries(
        TEXT_FILTER_FIELDS.map((field, i) => [field, textOptions[i]]),
      ) as Record<TextFilterField, string[]>),
      certification: uniqueIgnoringCase(certification.map((r) => r.value)),
      launchYear: { min: years._min.launchYear, max: years._max.launchYear },
    };
  }

  /** Distinct values of a column, merging spelling variants into the most frequent one. */
  private async distinctValues(field: TextFilterField): Promise<string[]> {
    // The column name comes from a fixed map, never from user input.
    const column = Prisma.raw(`"${COLUMN_OF[field]}"`);
    const rows = await this.prisma.$queryRaw<{ value: string }[]>`
      SELECT ${column} AS value FROM product WHERE delisted_at IS NULL
      GROUP BY 1 ORDER BY count(*) DESC`;
    return uniqueIgnoringCase(rows.map((r) => r.value));
  }

  /** Average and count of review ratings per product, computed in one query (DECISIONS §1.5). */
  private async ratingSummaries(
    productIds: string[],
  ): Promise<Map<string, RatingSummary>> {
    if (productIds.length === 0) return new Map();
    const groups = await this.prisma.review.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds } },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return new Map(
      groups.map((g) => [
        g.productId,
        {
          average:
            g._avg.rating === null
              ? null
              : Math.round(g._avg.rating * 100) / 100,
          count: g._count._all,
        },
      ]),
    );
  }
}

/** Drops the internal id and attaches the product's rating summary (or "no reviews"). */
function toView(
  { id, ...product }: ProductRow,
  ratings: Map<string, RatingSummary>,
): ProductView {
  return { ...product, rating: ratings.get(id) ?? NO_RATINGS };
}

/** The 404 thrown by every SKU lookup, so the message is consistent. */
function productNotFound(sku: string): NotFoundException {
  return new NotFoundException(`Product ${sku} not found`);
}
