import { readFileSync } from 'node:fs';
import request from 'supertest';
import { createTestApp } from '../fixtures/create-test-app';
import { CONTENT_LIMITS } from '../../src/domain/change-request';
import { MAX_BODY_BYTES } from '../../src/http/configure-http';

const valid = { title: 'عنوان', description: 'شرح', reason: 'دلیل' };
describe('US1؛ قرارداد سه عملیات', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => { context = await createTestApp(); });
  afterAll(async () => { await context.close(); });
  const server = () => context.app.getHttpServer();
  const auth = () => `Bearer ${context.fixture.token('requester-a')}`;

  it('AC-101؛ POST دارای 201، Location، ETag و فقط شش فیلد است', async () => {
    const response = await request(server()).post('/api/change-requests').set('Authorization', auth()).send(valid).expect(201);
    expect(Object.keys(response.body).sort()).toEqual(['id', 'title', 'description', 'reason', 'requesterId', 'status'].sort());
    expect(response.headers.location).toBe(`/api/change-requests/${response.body.id}`);
    expect(response.headers.etag).toMatch(/^"cf-[0-9a-f-]{36}-[0-9a-f-]{36}"$/);
    expect(response.headers['cache-control']).toBe('no-store');
    const get = await request(server()).get(response.headers.location!).set('Authorization', auth()).expect(200);
    expect(get.body).toEqual(response.body); expect(get.headers.etag).toBe(response.headers.etag);
    const update = await request(server()).put(response.headers.location!).set('Authorization', auth()).set('If-Match', get.headers.etag!).send({ ...valid, title: 'تازه' }).expect(200);
    expect(update.headers.etag).not.toBe(get.headers.etag);
    expect(Object.keys(update.body).sort()).toEqual(Object.keys(response.body).sort());
    expect(update.headers['cache-control']).toBe('no-store');
  });

  it.each(Object.entries(CONTENT_LIMITS))('AC-112؛ Schema خام و رفتار واقعی برای حداکثر %s با فاصله سازگارند', async (field, maximum) => {
    const contract = JSON.parse(readFileSync('specs/001-change-request-management/contracts/openapi.json', 'utf8'));
    expect(contract.components.schemas.WriteChangeRequest.properties[field].maxLength).toBeUndefined();
    const text = '😀'.repeat(maximum);
    const response = await request(server()).post('/api/change-requests').set('Authorization', auth()).send({ ...valid, [field]: ` ${text} ` }).expect(201);
    expect(context.fixture.requests.find(response.body.id)).toHaveProperty(field, text);
    for (const value of ['😀'.repeat(maximum + 1), '   ']) await request(server()).post('/api/change-requests').set('Authorization', auth()).send({ ...valid, [field]: value }).expect(400);
  });

  it('AC-115 و AC-116؛ خطاهای ورودی و هویت فارسی هستند', async () => {
    const invalid = await request(server()).post('/api/change-requests').set('Authorization', auth()).send({ ...valid, status: 'Draft' }).expect(400);
    expect(invalid.body.errors[0].field).toBe('status');
    expect(invalid.body.message).toMatch(/[\u0600-\u06ff]/);
    const unauthorized = await request(server()).post('/api/change-requests').send(valid).expect(401);
    expect(unauthorized.body.category).toBe('هویت نامعتبر');
    expect(unauthorized.headers['www-authenticate']).toBe('Bearer');
  });

  it('D-07؛ بدنهٔ خام دقیقاً در سقف با محتوای معتبر پذیرفته و یک بایت بیشتر رد می‌شود', async () => {
    const padding = MAX_BODY_BYTES - Buffer.byteLength(JSON.stringify(valid));
    const exact = JSON.stringify({ ...valid, title: ' '.repeat(padding) + valid.title });
    expect(Buffer.byteLength(exact)).toBe(MAX_BODY_BYTES);
    const response = await request(server()).post('/api/change-requests').set('Authorization', auth()).set('Content-Type', 'application/json').send(exact).expect(201);
    expect(context.fixture.requests.find(response.body.id)).toMatchObject(valid);
    const before = context.fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all();
    const oversized = await request(server()).post('/api/change-requests').set('Authorization', 'Bearer invalid').set('Content-Type', 'application/json').send(exact + ' ').expect(413);
    expect(oversized.body.code).toBe('PAYLOAD_TOO_LARGE');
    expect(context.fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all()).toEqual(before);
  });
});
