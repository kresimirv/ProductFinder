import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { ImportModule } from './import/import.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { ReviewsModule } from './reviews/reviews.module';

/** Root module: infrastructure (Prisma, rate limiting) plus the feature modules. */
@Module({
  imports: [
    // Rate limit for the only public write (POST reviews), applied per client IP by
    // ThrottlerGuard on that route. Read endpoints are not throttled.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    PrismaModule,
    HealthModule,
    ImportModule,
    ProductsModule,
    ReviewsModule,
  ],
})
export class AppModule {}
