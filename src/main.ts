import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { environment } from './common/config/environment';
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  await app.listen(environment.port, '0.0.0.0');
}
bootstrap().catch(() => {
  console.error('Application startup failed; check environment and port availability.');
  process.exitCode = 1;
});
