import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * The application's single Prisma client.
 *
 * Prisma 7 talks to PostgreSQL through a driver adapter (`pg`). The connection
 * string comes from `DATABASE_URL`, which is loaded from `.env` in `main.ts`, or set
 * by the e2e test setup.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set (see product-finder-api/.env.example)',
      );
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  /** Connect eagerly so a misconfigured database fails at startup, not on the first request. */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** Closes the connection pool on shutdown (Nest calls this thanks to `enableShutdownHooks`). */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
