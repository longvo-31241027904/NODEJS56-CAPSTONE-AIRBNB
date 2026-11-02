import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { environment } from './common/config/environment';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseSuccessInterceptor } from './common/interceptors/response.interceptor';
import { NestExpressApplication } from '@nestjs/platform-express';
import rateLimit from 'express-rate-limit';
export function configureApp(app: NestExpressApplication) {
  if (environment.trustProxyHops) app.set('trust proxy', environment.trustProxyHops);
  app.use(
    '/api/auth/signin',
    rateLimit({
      windowMs: 10 * 60 * 1000,
      limit: 5,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) =>
        res
          .status(429)
          .json({ status: 'error', statusCode: 429, message: 'Too many signin attempts' }),
    }),
  );
  app.useStaticAssets(environment.uploadDir, {
    prefix: '/uploads/avatars/',
    index: false,
    dotfiles: 'deny',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");
    },
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseSuccessInterceptor());
  app.enableCors({
    origin: environment.origins.length ? environment.origins : false,
    allowedHeaders: ['Content-Type', 'token', 'Authorization'],
  });
  app.enableShutdownHooks();
  const config = new DocumentBuilder()
    .setTitle('Airbnb Backend')
    .setVersion('0.3.0')
    .setDescription(
      'Success: {status,statusCode,data}; error: {status,statusCode,message}. Use token header; Bearer also accepted. Conflicting headers return 401.',
    )
    .addApiKey({ type: 'apiKey', in: 'header', name: 'token' }, 'token')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
}
