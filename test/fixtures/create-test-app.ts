import 'reflect-metadata';
import type { Type, Provider } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureHttp } from '../../src/http/configure-http';
import { createDatabaseFixture } from './database-fixture';

export async function createTestApp(controllers: Type[] = [], providers: Provider[] = []) {
  const fixture = createDatabaseFixture();
  try {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(fixture.configuration)], controllers, providers }).compile();
    const app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
    configureHttp(app);
    try { await app.init(); }
    catch (error) { await app.close(); throw error; }
    return { app, fixture, close: async () => { try { await app.close(); } finally { fixture.close(); } } };
  } catch (error) { fixture.close(); throw error; }
}
