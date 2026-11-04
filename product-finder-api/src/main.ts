import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

/** Starts the HTTP API: global setup, OpenAPI docs, then listens on `PORT` (default 3000). */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  // Interactive API docs at /api/docs. They're generated from the DTOs and their TSDoc
  // comments by the @nestjs/swagger CLI plugin (nest-cli.json), so they can't drift from the code.
  const openApi = new DocumentBuilder()
    .setTitle('Product Finder API')
    .setVersion('1')
    .build();
  SwaggerModule.setup('api/docs', app, () =>
    SwaggerModule.createDocument(app, openApi),
  );

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
