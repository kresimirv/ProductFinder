import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

/** Customer reviews, nested under products: /products/:sku/reviews. */
@Module({
  imports: [ProductsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
