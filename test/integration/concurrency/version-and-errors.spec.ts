import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp } from '../../fixtures/create-test-app';
import { ControlledWorker, recordRace } from '../../fixtures/concurrency-coordinator';
import { encodeEtag } from '../../../src/http/etag';
import { RequestVisibility } from '../../../src/application/request-visibility';
import { RequestChanges } from '../../../src/application/request-changes';

const content = { title: 'نسخهٔ تازه', description: 'شرح تازه', reason: 'دلیل تازه' };

describe('US5؛ نسخه و بازبینی نهایی مجوز در HTTP واقعی', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>; let workers: ControlledWorker[];
  beforeEach(async () => { context = await createTestApp(); workers = []; });
  afterEach(async () => { await Promise.all(workers.map(worker => worker.close())); await context.close(); });
  const auth = (subject = 'requester-a') => `Bearer ${context.fixture.token(subject)}`;
  const snapshot = () => context.fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all();

  it.each(['Draft', 'ChangesRequested'] as const)('AC-508؛ ویرایش قدیمی %s بعد از Commit مستقل، 412 فارسی دارد', async status => {
    const fixture = context.fixture, row = fixture.records.owned[status];
    const worker = new ControlledWorker({ filename: fixture.filename, issuer: fixture.configuration.jwtIssuer, subject: 'requester-a', id: row.id, version: row.version, operation: 'edit', content }); workers.push(worker);
    await worker.phase('ready'); worker.start(); expect((await worker.phase('result')).code).toBe('OK');
    const committed = snapshot();
    const response = await request(context.app.getHttpServer()).put(`/api/change-requests/${row.id}`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send({ ...content, title: 'نباید ثبت شود' }).expect(412);
    expect(response.body.category).toBe('تعارض هم‌زمان'); expect(response.body.message).toMatch(/[\u0600-\u06ff]/); expect(response.headers.etag).toBeUndefined();
    expect(snapshot()).toEqual(committed);
    recordRace(`HTTP نسخهٔ قدیمی ${status}`, workers, { response: response.body, request: fixture.requests.find(row.id) });
  }, 30000);

  it.each(['missing', 'weak', 'wildcard', 'multiple', 'malformed'] as const)('If-Match از نوع %s رد می‌شود و درخواست تغییر نمی‌کند', async kind => {
    const row = context.fixture.records.owned.Draft, before = snapshot(), tag = encodeEtag(row);
    const operation = request(context.app.getHttpServer()).put(`/api/change-requests/${row.id}`).set('Authorization', auth());
    const values = { weak: `W/${tag}`, wildcard: '*', multiple: `${tag}, ${tag}`, malformed: 'invalid' };
    if (kind !== 'missing') operation.set('If-Match', values[kind]);
    const response = await operation.send(content).expect(kind === 'missing' ? 428 : 400);
    expect(response.body.message).toMatch(/[\u0600-\u06ff]/); expect(snapshot()).toEqual(before);
  });

  it.each(['missing', 'invalid', 'valid'] as const)('AC-313 و AC-316؛ منبع پنهان/ناموجود با header از نوع %s یکسان است', async header => {
    const row = context.fixture.records.owned.Draft, before = snapshot();
    for (const action of ['get', 'edit', 'submit', 'approve', 'request-changes']) {
      const responses = [];
      for (const id of [row.id, randomUUID()]) {
        const url = `/api/change-requests/${id}`;
        const operation = action === 'get' ? request(context.app.getHttpServer()).get(url) : action === 'edit' ? request(context.app.getHttpServer()).put(url) : request(context.app.getHttpServer()).post(`${url}/${action}`);
        operation.set('Authorization', auth('reviewer-b')).set('Content-Type', 'application/json');
        if (header !== 'missing') operation.set('If-Match', header === 'invalid' ? '*' : encodeEtag(row));
        responses.push(await operation.send('{').expect(404));
      }
      expect(responses[0]!.body).toEqual(responses[1]!.body);
      for (const response of responses) { expect(Object.keys(response.body).sort()).toEqual(['category', 'code', 'message']); expect(response.headers.etag).toBeUndefined(); expect(response.headers.location).toBeUndefined(); }
    }
    expect(snapshot()).toEqual(before);
  });

  it('AC-205؛ Submit تکراری مالک پیش از ورودی و نسخه خطای وضعیت دارد', async () => {
    const row = context.fixture.records.owned.Draft;
    const url = `/api/change-requests/${row.id}/submit`;
    await request(context.app.getHttpServer()).post(url).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send({}).expect(204);
    const committed = snapshot();
    await request(context.app.getHttpServer()).post(url).set('Authorization', auth()).set('If-Match', encodeEtag(row)).set('Content-Type', 'application/json').send('{').expect(409);
    expect(snapshot()).toEqual(committed);
  });

  it.each(['role', 'visibility'] as const)('AC-306، AC-312 و AC-316؛ تغییر %s بین Guard و Application دوباره بررسی می‌شود', async change => {
    const fixture = context.fixture, row = fixture.records.owned.PendingReview;
    const visibility = context.app.get(RequestVisibility), original = visibility.execute.bind(visibility);
    jest.spyOn(visibility, 'execute').mockImplementationOnce((identity, id) => {
      const visible = original(identity, id);
      if (change === 'role') fixture.permissions.execute(fixture.configuration.jwtIssuer, 'reviewer-b', { isRequester: false, isReviewer: false });
      else new RequestChanges(fixture.unit, fixture.users, fixture.requests).execute(fixture.identity('reviewer-d'), row.id, () => ({}), () => row);
      return visible;
    });
    const response = await request(context.app.getHttpServer()).post(`/api/change-requests/${row.id}/approve`).set('Authorization', auth('reviewer-b')).set('If-Match', encodeEtag(row)).set('Content-Type', 'application/json').send('{').expect(404);
    expect(Object.keys(response.body).sort()).toEqual(['category', 'code', 'message']); expect(response.headers.etag).toBeUndefined();
    const final = fixture.requests.find(row.id)!;
    if (change === 'role') expect(final).toEqual(row);
    else { expect(final).toEqual({ ...row, status: 'ChangesRequested', version: expect.any(String) }); expect(final.version).not.toBe(row.version); }
    recordRace(`تغییر ${change} پس از Guard`, workers, { response: response.body, request: final });
  });
});
