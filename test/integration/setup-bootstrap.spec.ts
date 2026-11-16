import request from 'supertest';
import { createTestApp } from '../fixtures/create-test-app';

describe('راه‌اندازی HTTP و محدودهٔ مسیرها', () => {
  it('با adapter واقعی راه‌اندازی می‌شود و فهرست عمومی درخواست‌ها ارائه نمی‌شود', async () => {
    const context = await createTestApp();
    try {
      await request(context.app.getHttpServer()).get('/api/change-requests').expect(404);
    } finally {
      await context.close();
    }
  });
});
