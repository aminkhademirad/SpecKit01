import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('اسکلت HTTP بدون قابلیت محصول', () => {
  it('با adapter واقعی راه‌اندازی می‌شود و مسیر محصول هنوز وجود ندارد', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
    try {
      await app.init();
      await request(app.getHttpServer()).get('/api/change-requests').expect(404);
    } finally {
      await app.close();
    }
  });
});
