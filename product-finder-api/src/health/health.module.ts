import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/** GET /api/v1/health: used by the Docker Compose healthcheck. */
@Module({ controllers: [HealthController] })
export class HealthModule {}
