import request from 'supertest';
import { createTestApp } from '../fixtures/create-test-app';

describe('اسکلت HTTP بدون قابلیت محصول', () => {
  it('با adapter واقعی راه‌اندازی می‌شود و مسیر محصول هنوز وجود ندارد', async () => {
    const context = await createTestApp();
    try {
      await request(context.app.getHttpServer()).get('/api/change-requests').expect(404);
    } finally {
      await context.close();
    }
  });
});
