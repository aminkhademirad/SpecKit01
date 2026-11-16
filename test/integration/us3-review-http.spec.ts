import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp } from '../fixtures/create-test-app';
import { encodeEtag } from '../../src/http/etag';

describe('US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>;
  beforeEach(async () => { context = await createTestApp(); });
  afterEach(async () => { await context.close(); });
  const server = () => context.app.getHttpServer();
  const auth = (subject = 'reviewer-b') => `Bearer ${context.fixture.token(subject)}`;
  const snapshot = () => context.fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all();

  for (const action of ['approve', 'request-changes'] as const) {
    const destination = action === 'approve' ? 'Approved' : 'ChangesRequested';
    describe(action, () => {
      it.each(['absent', 'empty'])('AC-301 و AC-302؛ موفقیت با بدنهٔ %s پاسخ 204 بدون داده می‌دهد', async body => {
        const row = context.fixture.records.owned.PendingReview;
        const operation = request(server()).post(`/api/change-requests/${row.id}/${action}`).set('Authorization', auth()).set('If-Match', encodeEtag(row));
        if (body === 'empty') operation.send({});
        const response = await operation.expect(204);
        expect(response.text).toBe(''); expect(response.headers.etag).toBeUndefined(); expect(response.headers.location).toBeUndefined();
        expect(response.headers['cache-control']).toBe('no-store');
        const after = context.fixture.requests.find(row.id)!;
        expect(after).toEqual({ ...row, status: destination, version: expect.any(String) }); expect(after.version).not.toBe(row.version);
        await request(server()).get(`/api/change-requests/${row.id}`).set('Authorization', auth()).expect(404);
        const owner = await request(server()).get(`/api/change-requests/${row.id}`).set('Authorization', auth('requester-a')).expect(200);
        expect(owner.body.status).toBe(destination); expect(owner.headers.etag).toBe(encodeEtag(after));
      });

      it('AC-303، AC-311 و AC-314؛ تصمیم روی درخواست خود حتی با دو نقش 403 صریح است', async () => {
        const row = context.fixture.records.dual.PendingReview, before = snapshot();
        const response = await request(server()).post(`/api/change-requests/${row.id}/${action}`).set('Authorization', auth('dual-c')).set('Content-Type', 'application/json').send('{').expect(403);
        expect(response.body.category).toBe('مجوز ناکافی برای درخواست قابل مشاهده');
        expect(response.body.message).toContain('خود'); expect(response.headers.etag).toBeUndefined();
        expect(snapshot()).toEqual(before);
      });

      it('AC-304 و AC-306؛ هویت نامعتبر، نگاشت ناموجود و نقش لغوشده اثری ندارند', async () => {
        const row = context.fixture.records.owned.PendingReview, before = snapshot();
        await request(server()).post(`/api/change-requests/${row.id}/${action}`).set('Content-Type', 'application/json').send('{').expect(401);
        await request(server()).post(`/api/change-requests/${row.id}/${action}`).set('Authorization', auth('unknown')).send({}).expect(404);
        const token = auth();
        context.fixture.permissions.execute(context.fixture.configuration.jwtIssuer, 'reviewer-b', { isRequester: false, isReviewer: false });
        await request(server()).post(`/api/change-requests/${row.id}/${action}`).set('Authorization', token).set('If-Match', encodeEtag(row)).send({}).expect(404);
        expect(snapshot()).toEqual(before);
      });

      it.each(['Draft', 'ChangesRequested', 'Approved'] as const)('AC-305؛ وضعیت %s برای Reviewer خارج از دید است', async status => {
        const row = context.fixture.records.owned[status], before = snapshot();
        const response = await request(server()).post(`/api/change-requests/${row.id}/${action}`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send({}).expect(404);
        expect(response.body.code).toBe('REQUEST_UNAVAILABLE'); expect(snapshot()).toEqual(before);
      });

      it('AC-309 و AC-312؛ تکرار تصمیم پس از ازدست‌رفتن visibility یک 404 عمومی است', async () => {
        const row = context.fixture.records.owned.PendingReview;
        await request(server()).post(`/api/change-requests/${row.id}/${action}`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send({}).expect(204);
        const committed = snapshot();
        const repeat = await request(server()).post(`/api/change-requests/${row.id}/${action}`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).set('Content-Type', 'application/json').send('{').expect(404);
        const missing = await request(server()).post(`/api/change-requests/${randomUUID()}/${action}`).set('Authorization', auth()).send({}).expect(404);
        expect(repeat.body).toEqual(missing.body); expect(repeat.headers.etag).toBeUndefined(); expect(repeat.body.errors).toBeUndefined();
        expect(snapshot()).toEqual(committed);
      });

      it.each([['missing', 428], ['invalid', 400], ['stale', 412]] as const)('پیش‌شرط %s بدون تغییر رد می‌شود', async (kind, status) => {
        const row = context.fixture.records.owned.PendingReview, before = snapshot();
        const operation = request(server()).post(`/api/change-requests/${row.id}/${action}`).set('Authorization', auth());
        if (kind !== 'missing') operation.set('If-Match', kind === 'invalid' ? '*' : encodeEtag({ ...row, version: randomUUID() }));
        await operation.send({}).expect(status); expect(snapshot()).toEqual(before);
      });

      it.each(['{', 'null', '[]', '{"status":"Approved"}', '{"reason":"نظر"}'])('بدنهٔ نامعتبر %s تغییری نمی‌دهد', async body => {
        const row = context.fixture.records.owned.PendingReview, before = snapshot();
        const response = await request(server()).post(`/api/change-requests/${row.id}/${action}`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).set('Content-Type', 'application/json').send(body).expect(400);
        expect(response.body.errors[0].field).toBeTruthy(); expect(snapshot()).toEqual(before);
      });
    });
  }

  it('AC-307 و AC-315؛ Approved هیچ ویرایش یا انتقال خروجی ندارد', async () => {
    const row = context.fixture.records.owned.Approved, before = snapshot();
    for (const subject of ['requester-a', 'reviewer-b', 'dual-c']) {
      const owner = subject === 'requester-a';
      await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth(subject)).set('If-Match', encodeEtag(row)).send({ title: 'تغییر', description: 'شرح', reason: 'دلیل' }).expect(owner ? 409 : 404);
      const submit = await request(server()).post(`/api/change-requests/${row.id}/submit`).set('Authorization', auth(subject)).send({}).expect(owner ? 409 : 404);
      if (owner) expect(submit.body.category).toBe('وضعیت نامعتبر');
      for (const action of ['approve', 'request-changes']) await request(server()).post(`/api/change-requests/${row.id}/${action}`).set('Authorization', auth(subject)).send({}).expect(owner ? 403 : 404);
    }
    expect(snapshot()).toEqual(before);
  });

  it('AC-308 تا AC-310؛ مشاهدهٔ Reviewer و دو نقش از سیاست جاری پیروی می‌کند', async () => {
    const fixture = context.fixture;
    fixture.unit.write(() => fixture.users.provision(fixture.configuration.jwtIssuer, 'requester-other', { isRequester: true, isReviewer: false }));
    for (const status of ['Draft', 'PendingReview', 'ChangesRequested', 'Approved'] as const) {
      const row = fixture.records.owned[status];
      await request(server()).get(`/api/change-requests/${row.id}`).set('Authorization', auth()).expect(status === 'PendingReview' ? 200 : 404);
      await request(server()).get(`/api/change-requests/${row.id}`).set('Authorization', auth('requester-other')).expect(404);
      await request(server()).get(`/api/change-requests/${row.id}`).set('Authorization', auth('dual-c')).expect(status === 'PendingReview' ? 200 : 404);
      await request(server()).get(`/api/change-requests/${fixture.records.dual[status].id}`).set('Authorization', auth('dual-c')).expect(200);
    }
  });

  it('AC-313 و AC-316؛ منبع پنهان و ناموجود در تصمیم پاسخ یکسان دارند', async () => {
    const before = snapshot();
    for (const action of ['approve', 'request-changes']) {
      const replies = [];
      for (const id of [context.fixture.records.owned.Draft.id, randomUUID()]) replies.push(await request(server()).post(`/api/change-requests/${id}/${action}`).set('Authorization', auth()).set('If-Match', '*').set('Content-Type', 'application/json').send('{').expect(404));
      expect(replies[0]!.body).toEqual(replies[1]!.body);
      expect(replies[0]!.body.category).toBe('درخواست در دسترس نیست');
    }
    expect(snapshot()).toEqual(before);
  });
});
