import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigurationError, loadConfiguration } from './infrastructure/configuration';

async function bootstrap(): Promise<void> {
  const configuration = loadConfiguration();
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: false });
  app.enableShutdownHooks();
  await app.listen(configuration.port, '127.0.0.1');
  console.info('اسکلت ChangeFlow برای محیط محلی اجرا شد.');
}

void bootstrap().catch((error: unknown) => {
  console.error(error instanceof ConfigurationError ? error.message : 'راه‌اندازی برنامه ناموفق بود.');
  process.exitCode = 1;
});
