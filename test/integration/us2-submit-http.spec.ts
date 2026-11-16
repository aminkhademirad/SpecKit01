import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp } from '../fixtures/create-test-app';
import { encodeEtag } from '../../src/http/etag';

describe('US2؛ HTTP و قرارداد Submit با Database واقعی', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>;
  beforeEach(async () => { context = await createTestApp(); });
  afterEach(async () => { await context.close(); });
  const server = () => context.app.getHttpServer();
  const auth = (subject = 'requester-a') => `Bearer ${context.fixture.token(subject)}`;
  const snapshot = () => context.fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all();

  it.each(['absent', 'empty'])('AC-201؛ بدنهٔ %s، پاسخ 204 بدون Body/ETag و انتقال فقط status/version', async body => {
    const row = context.fixture.records.owned.Draft;
    const operation = request(server()).post(`/api/change-requests/${row.id}/submit`).set('Authorization', auth()).set('If-Match', encodeEtag(row));
    if (body === 'empty') operation.send({});
    const response = await operation.expect(204);
    expect(response.text).toBe(''); expect(response.headers.etag).toBeUndefined(); expect(response.headers.location).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
    const after = context.fixture.requests.find(row.id)!;
    expect(after).toEqual({ ...row, status: 'PendingReview', version: expect.any(String) }); expect(after.version).not.toBe(row.version);
    const get = await request(server()).get(`/api/change-requests/${row.id}`).set('Authorization', auth()).expect(200);
    expect(get.headers.etag).toBe(encodeEtag(after));
  });

  it.each(['reviewer-b', 'dual-c'])('AC-202؛ غیرمالک %s بدون تغییر رد می‌شود', async subject => {
    const row = context.fixture.records.owned.Draft, before = snapshot();
    await request(server()).post(`/api/change-requests/${row.id}/submit`).set('Authorization', auth(subject)).set('If-Match', encodeEtag(row)).send({}).expect(404);
    expect(snapshot()).toEqual(before);
  });

  it.each(['PendingReview', 'Approved'] as const)('AC-203؛ ویرایش %s همچنان ممنوع است', async status => {
    const row = context.fixture.records.owned[status], before = snapshot();
    await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send({ title: 'تازه', description: 'شرح', reason: 'دلیل' }).expect(409);
    expect(snapshot()).toEqual(before);
  });

  it('AC-204؛ هویت نامعتبر، نقش لغوشده و نگاشت ناموجود تغییری نمی‌دهند', async () => {
    const row = context.fixture.records.owned.Draft, before = snapshot();
    const unauthenticated = await request(server()).post(`/api/change-requests/${row.id}/submit`).set('Content-Type', 'application/json').send('{').expect(401);
    expect(unauthenticated.body.category).toBe('هویت نامعتبر');
    expect(unauthenticated.headers['www-authenticate']).toBe('Bearer');
    const token = auth();
    context.fixture.permissions.execute(context.fixture.configuration.jwtIssuer, 'requester-a', { isRequester: false, isReviewer: false });
    await request(server()).post(`/api/change-requests/${row.id}/submit`).set('Authorization', token).set('Content-Type', 'application/json').send('{').expect(403);
    await request(server()).post(`/api/change-requests/${row.id}/submit`).set('Authorization', auth('unknown')).send({}).expect(404);
    expect(snapshot()).toEqual(before);
  });

  it('AC-205؛ Submit تکراری با نسخهٔ قدیمی یا بدنهٔ نامعتبر 409 است', async () => {
    const row = context.fixture.records.owned.Draft;
    await request(server()).post(`/api/change-requests/${row.id}/submit`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send({}).expect(204);
    const committed = snapshot();
    for (const body of ['{}', '{']) {
      const response = await request(server()).post(`/api/change-requests/${row.id}/submit`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).set('Content-Type', 'application/json').send(body).expect(409);
      expect(response.body.code).toBe('INVALID_STATE'); expect(response.headers.etag).toBeUndefined();
      expect(snapshot()).toEqual(committed);
    }
  });

  it('AC-206؛ عملیات لغو برای مالک یا Reviewer وجود ندارد', async () => {
    const row = context.fixture.records.owned.PendingReview, before = snapshot();
    for (const subject of ['requester-a', 'reviewer-b']) await request(server()).post(`/api/change-requests/${row.id}/cancel`).set('Authorization', auth(subject)).send({}).expect(404);
    expect(snapshot()).toEqual(before);
  });

  it.each([
    ['missing', 428], ['invalid', 400], ['stale', 412],
  ] as const)('پیش‌شرط %s بدون تغییر رد می‌شود', async (kind, status) => {
    const row = context.fixture.records.owned.Draft, before = snapshot();
    const operation = request(server()).post(`/api/change-requests/${row.id}/submit`).set('Authorization', auth());
    if (kind !== 'missing') operation.set('If-Match', kind === 'invalid' ? '*' : encodeEtag({ ...row, version: randomUUID() }));
    const response = await operation.send({}).expect(status);
    expect(response.body.message).toMatch(/[\u0600-\u06ff]/); expect(snapshot()).toEqual(before);
  });

  it.each(['{"status":"PendingReview"}', '{"requesterId":"self"}', '{"reason":"text"}', 'null', '[]', '{'])('بدنهٔ غیرخالی یا نامعتبر %s رد کامل می‌شود', async body => {
    const row = context.fixture.records.owned.Draft, before = snapshot();
    const response = await request(server()).post(`/api/change-requests/${row.id}/submit`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).set('Content-Type', 'application/json').send(body).expect(400);
    expect(response.body.errors[0].field).toBeTruthy(); expect(snapshot()).toEqual(before);
  });

  it('منبع پنهان، ناموجود و شناسهٔ نامعتبر با JSON/header نامعتبر یکسان‌اند', async () => {
    const before = snapshot(); let expected: unknown;
    for (const id of [context.fixture.records.dual.Draft.id, randomUUID(), 'invalid-id']) {
      const response = await request(server()).post(`/api/change-requests/${id}/submit`).set('Authorization', auth()).set('If-Match', '*').set('Content-Type', 'application/json').send('{').expect(404);
      expected ??= response.body; expect(response.body).toEqual(expected); expect(response.body.errors).toBeUndefined(); expect(response.headers.etag).toBeUndefined();
    }
    expect(snapshot()).toEqual(before);
  });

  it('غیرمالک روی PendingReview قابل مشاهده، پیش از وضعیت یا JSON رد می‌شود', async () => {
    const row = context.fixture.records.owned.PendingReview, before = snapshot();
    await request(server()).post(`/api/change-requests/${row.id}/submit`).set('Authorization', auth('reviewer-b')).set('Content-Type', 'application/json').send('{').expect(403);
    expect(snapshot()).toEqual(before);
  });

  it('ارسال مجدد ChangesRequested از همان مسیر Submit انجام می‌شود', async () => {
    const row = context.fixture.records.owned.ChangesRequested;
    await request(server()).post(`/api/change-requests/${row.id}/submit`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send({}).expect(204);
    const after = context.fixture.requests.find(row.id)!;
    expect(after).toEqual({ ...row, status: 'PendingReview', version: expect.any(String) });
    expect(after.version).not.toBe(row.version);
  });
});
