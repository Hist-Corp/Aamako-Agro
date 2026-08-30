import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WsAdapter } from '@nestjs/platform-ws';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers. CSP keeps helmet's safe defaults (allows the Swagger UI
  // to load) and adds a strict Referrer-Policy so tokens/URLs in the address
  // bar are never leaked to third parties.
  app.use(
    helmet({
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // Behind Render's (and typical reverse-) proxy, the request IP is only
  // correct if the first hop is trusted. This keeps per-IP rate limiting and
  // session IP logging accurate in production. In local dev requests are
  // direct, so leave it off.
  if (process.env.NODE_ENV === 'production') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  // CORS locked to known frontend origins (no wildcard)
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  // Global validation — rejects unknown fields
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api');
  app.useWebSocketAdapter(new WsAdapter(app));

  const config = new DocumentBuilder()
    .setTitle('Aamako Agro API')
    .setDescription('REST API for the storefront + admin dashboard')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(Number(process.env.PORT ?? 3000));
  console.log(`API ready on http://localhost:${process.env.PORT ?? 3000}/api/docs`);
}
void bootstrap();
