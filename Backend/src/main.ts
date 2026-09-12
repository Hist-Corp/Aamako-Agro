import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WsAdapter } from '@nestjs/platform-ws';
import * as express from 'express';
import * as path from 'path';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { gzipMiddleware } from './common/gzip.middleware';

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

  // Gzip-compress compressible API responses (text/JSON >= 1 KB) when the
  // client advertises Accept-Encoding: gzip. Set DISABLE_GZIP=1 to opt out.
  app.use(gzipMiddleware);

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

  // Serve uploaded product/media images at /api/uploads/<file>.
  // CORP is relaxed to cross-origin because these images are legitimately
  // embedded by the dashboard (:3001) and storefront (:8080) — helmet's
  // default `same-origin` policy would block them from rendering there.
  //
  // Upload hardening (the only files that reach this dir via the API are
  // image/*-accepted uploads, but a few types — notably SVG, and any file
  // whose uploaded bytes the optimizer stores byte-for-byte — are capable of
  // carrying active content):
  //   • `X-Content-Type-Options: nosniff` prevents a browser from MIME-sniffing
  //     mislabeled bytes into an executable type (e.g. an HTML blob uploaded
  //     as image/png).
  //   • `Content-Security-Policy: sandbox` disables scripting inside any SVG
  //     (or media) document served from here, killing the stored-XSS vector
  //     that an admin-uploaded vector image could otherwise carry when it is
  //     navigated to directly or embedded via object/embed/iframe. Rendering
  //     the image inside an <img> tag (the storefront/dashboard use-case) is
  //     unaffected by this CSP.
  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.use('/api/uploads', express.static(uploadsDir, {
    maxAge: '7d',
    immutable: true,
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // `sandbox` — the served document gets no execution context; blocks
      // script in uploaded SVG/media without affecting <img> rendering.
      res.setHeader('Content-Security-Policy', 'sandbox');
    },
  }));
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
