import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigurationError, loadConfiguration } from './infrastructure/configuration';
import { configureHttp } from './http/configure-http';
import { MigrationError } from './infrastructure/sqlite/migration-runner';

async function bootstrap(): Promise<void> {
  const configuration = loadConfiguration();
  const app = await NestFactory.create(AppModule.forRoot(configuration), { bodyParser: false, logger: false, abortOnError: false });
  configureHttp(app);
  app.enableShutdownHooks();
  await app.listen(configuration.port, '127.0.0.1');
  console.info('اسکلت ChangeFlow برای محیط محلی اجرا شد.');
}

void bootstrap().catch((error: unknown) => {
  console.error(error instanceof ConfigurationError || error instanceof MigrationError ? error.message : 'راه‌اندازی برنامه ناموفق بود.');
  process.exitCode = 1;
});
