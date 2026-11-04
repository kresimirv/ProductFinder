import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { Paginated, toSkipTake } from '../common/pagination';
import { PaginationQueryDto } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { CreateReviewDto } from './create-review.dto';

/** Fields exposed by the API (the internal product id is left out). */
const REVIEW_FIELDS = {
  id: true,
  rating: true,
  title: true,
  body: true,
  authorName: true,
  createdAt: true,
} satisfies Prisma.ReviewSelect;

/** A review as returned by the API. */
export type ReviewView = Prisma.ReviewGetPayload<{
  select: typeof REVIEW_FIELDS;
}>;

/** Reading and writing customer reviews. This is the application's only write flow. */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
  ) {}

  /** Reviews of a product, newest first. @throws NotFoundException for an unknown SKU. */
  async list(
    sku: string,
    page: PaginationQueryDto,
  ): Promise<Paginated<ReviewView>> {
    const productId = await this.products.findIdBySku(sku);
    const where = { productId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: REVIEW_FIELDS,
        ...toSkipTake(page),
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total, page: page.page, pageSize: page.pageSize };
  }

  /** @throws NotFoundException for an unknown SKU. */
  async create(sku: string, review: CreateReviewDto): Promise<ReviewView> {
    const productId = await this.products.findIdBySku(sku);
    return this.prisma.review.create({
      data: { ...review, productId },
      select: REVIEW_FIELDS,
    });
  }
}
