import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Global HTTP configuration. It's shared by `main.ts` and the e2e tests, so the tests
 * exercise exactly the pipeline that runs in production.
 */
export function configureApp(app: NestExpressApplication): void {
  // Behind nginx every request comes from the proxy. Trusting proxies on private
  // networks only (Docker network, localhost) makes Express take the client IP from
  // X-Forwarded-For, so the review rate limit applies per customer, not to everyone.
  // nginx overwrites that header with the real peer address, so clients can't spoof it.
  app.set('trust proxy', 'loopback, uniquelocal');
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties without validation decorators...
      forbidNonWhitelisted: true, // ...and reject requests that send them
      transform: true, // give controllers DTO instances with defaults applied
    }),
  );
  app.enableShutdownHooks();
}
