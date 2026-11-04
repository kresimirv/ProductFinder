import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Makes {@link PrismaService} injectable everywhere without importing this module. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
