import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Paginated } from '../common/pagination';
import { PaginationQueryDto } from '../common/pagination.dto';
import { CreateReviewDto } from './create-review.dto';
import { ReviewsService, ReviewView } from './reviews.service';

/** Review endpoints, nested under a product: `/api/v1/products/:sku/reviews`. */
@ApiTags('reviews')
@Controller('products/:sku/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** Reviews of a product, newest first. */
  @Get()
  list(
    @Param('sku') sku: string,
    @Query() page: PaginationQueryDto,
  ): Promise<Paginated<ReviewView>> {
    return this.reviews.list(sku, page);
  }

  /** Write a review. Rate-limited per client because there's no authentication. */
  @Post()
  @UseGuards(ThrottlerGuard)
  @ApiTooManyRequestsResponse({
    description: 'Too many reviews from this client',
  })
  create(
    @Param('sku') sku: string,
    @Body() review: CreateReviewDto,
  ): Promise<ReviewView> {
    return this.reviews.create(sku, review);
  }
}
