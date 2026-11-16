import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp } from '../fixtures/create-test-app';
import { encodeEtag } from '../../src/http/etag';
import { CONTENT_LIMITS } from '../../src/domain/change-request';

const valid = { title: 'عنوان تازه', description: 'شرح تازه', reason: 'دلیل تازه' };

function observedEtag(response: { headers: Record<string, unknown> }): string {
  const value = response.headers.etag;
  if (typeof value !== 'string') throw new Error('پاسخ باید ETag قابل استفاده داشته باشد.');
  return value;
}

describe('US4؛ پذیرش اصلاح و ارسال مجدد از HTTP و Database واقعی', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>;
  beforeEach(async () => { context = await createTestApp(); });
  afterEach(async () => { await context.close(); });
  const server = () => context.app.getHttpServer();
  const auth = (subject = 'requester-a') => `Bearer ${context.fixture.token(subject)}`;
  const snapshot = () => context.fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all();

  it.each(['requester-a', 'dual-c'])('AC-401 و AC-402؛ مالک %s درخواست برگشت‌خوردهٔ آماده را اصلاح و ارسال می‌کند', async subject => {
    const row = subject === 'dual-c' ? context.fixture.records.dual.ChangesRequested : context.fixture.records.owned.ChangesRequested;
    const response = await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth(subject)).set('If-Match', encodeEtag(row)).send(valid).expect(200);
    const edited = context.fixture.requests.find(row.id)!;
    expect(edited).toEqual({ ...row, ...valid, version: expect.any(String) }); expect(edited.version).not.toBe(row.version);
    expect(response.headers.etag).toBe(encodeEtag(edited)); expect(response.body).toMatchObject({ ...valid, id: row.id, requesterId: row.requesterId, status: 'ChangesRequested' }); expect(response.body.version).toBeUndefined();
    const submitted = await request(server()).post(`/api/change-requests/${row.id}/submit`).set('Authorization', auth(subject)).set('If-Match', observedEtag(response)).send({}).expect(204);
    expect(submitted.text).toBe(''); expect(submitted.headers.etag).toBeUndefined();
    const after = context.fixture.requests.find(row.id)!;
    expect(after).toEqual({ ...edited, status: 'PendingReview', version: expect.any(String) }); expect(after.version).not.toBe(edited.version);
    expect(snapshot()).toHaveLength(8);
    const committed = snapshot();
    await request(server()).post(`/api/change-requests/${row.id}/submit`).set('Authorization', auth(subject)).set('If-Match', observedEtag(response)).send({}).expect(409);
    await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth(subject)).send(valid).expect(409);
    expect(snapshot()).toEqual(committed);
  });

  it.each(['absent', 'empty'])('AC-402؛ ارسال مجدد مستقل با بدنهٔ %s موفق است', async body => {
    const row = context.fixture.records.owned.ChangesRequested;
    const pending = request(server()).post(`/api/change-requests/${row.id}/submit`).set('Authorization', auth()).set('If-Match', encodeEtag(row));
    if (body === 'empty') pending.send({});
    const response = await pending.expect(204);
    expect(response.text).toBe(''); expect(response.headers.etag).toBeUndefined(); expect(response.headers.location).toBeUndefined();
    const after = context.fixture.requests.find(row.id)!;
    expect(after).toEqual({ ...row, status: 'PendingReview', version: expect.any(String) }); expect(after.version).not.toBe(row.version);
  });

  it.each(['approve', 'request-changes'])('AC-404؛ چرخهٔ برگشت، اصلاح، ارسال و بررسی دوباره با %s', async finalAction => {
    const original = context.fixture.records.owned.PendingReview, url = `/api/change-requests/${original.id}`;
    const reviewer = await request(server()).get(url).set('Authorization', auth('reviewer-b')).expect(200);
    await request(server()).post(`${url}/request-changes`).set('Authorization', auth('reviewer-b')).set('If-Match', observedEtag(reviewer)).send({}).expect(204);
    const returned = context.fixture.requests.find(original.id)!;
    expect(returned).toEqual({ ...original, status: 'ChangesRequested', version: expect.any(String) });
    await request(server()).get(url).set('Authorization', auth('reviewer-b')).expect(404);
    const owner = await request(server()).get(url).set('Authorization', auth()).expect(200);
    expect(owner.headers.etag).toBe(encodeEtag(returned));
    await request(server()).put(url).set('Authorization', auth()).set('If-Match', observedEtag(owner)).send(valid).expect(200);
    const fresh = await request(server()).get(url).set('Authorization', auth()).expect(200);
    const edited = context.fixture.requests.find(original.id)!;
    expect(edited).toEqual({ ...returned, ...valid, version: expect.any(String) }); expect(edited.version).not.toBe(returned.version);
    expect(fresh.headers.etag).toBe(encodeEtag(edited));
    const beforeStale = snapshot();
    await request(server()).post(`${url}/submit`).set('Authorization', auth()).set('If-Match', observedEtag(owner)).send({}).expect(412);
    expect(snapshot()).toEqual(beforeStale);
    await request(server()).post(`${url}/submit`).set('Authorization', auth()).set('If-Match', observedEtag(fresh)).send({}).expect(204);
    const pending = context.fixture.requests.find(original.id)!;
    expect(pending).toEqual({ ...edited, status: 'PendingReview', version: expect.any(String) }); expect(pending.version).not.toBe(edited.version);
    const visible = await request(server()).get(url).set('Authorization', auth('reviewer-b')).expect(200);
    expect(visible.body).toMatchObject({ ...valid, id: original.id, requesterId: original.requesterId });
    await request(server()).post(`${url}/${finalAction}`).set('Authorization', auth('reviewer-b')).set('If-Match', observedEtag(visible)).send({}).expect(204);
    const final = context.fixture.requests.find(original.id)!;
    expect(final).toEqual({ ...pending, status: finalAction === 'approve' ? 'Approved' : 'ChangesRequested', version: expect.any(String) }); expect(final.version).not.toBe(pending.version);
    await request(server()).get(url).set('Authorization', auth('reviewer-b')).expect(404);
    const result = await request(server()).get(url).set('Authorization', auth()).expect(200);
    expect(result.headers.etag).toBe(encodeEtag(final)); expect(snapshot()).toHaveLength(8);
  });

  for (const operation of ['edit', 'submit']) {
    const call = (id: string) => operation === 'edit' ? request(server()).put(`/api/change-requests/${id}`) : request(server()).post(`/api/change-requests/${id}/submit`);
    describe(operation, () => {
      it.each(['reviewer-b', 'dual-c'])('AC-403؛ غیرمالک %s و شناسهٔ ناموجود پاسخ عمومی یکسان دارند', async subject => {
        const before = snapshot(), row = context.fixture.records.owned.ChangesRequested, replies = [];
        for (const id of [row.id, randomUUID()]) replies.push(await call(id).set('Authorization', auth(subject)).set('If-Match', '*').set('Content-Type', 'application/json').send('{').expect(404));
        expect(replies[0]!.body).toEqual(replies[1]!.body); expect(replies[0]!.headers.etag).toBeUndefined(); expect(snapshot()).toEqual(before);
      });
      it('نبود هویت و لغو مجوز جاری مالک پیش از بررسی ورودی رد می‌شوند', async () => {
        const before = snapshot(), row = context.fixture.records.owned.ChangesRequested, token = auth();
        await call(row.id).set('Content-Type', 'application/json').send('{').expect(401);
        context.fixture.permissions.execute(context.fixture.configuration.jwtIssuer, 'requester-a', { isRequester: false, isReviewer: false });
        await call(row.id).set('Authorization', token).set('Content-Type', 'application/json').send('{').expect(403);
        expect(snapshot()).toEqual(before);
      });
      it.each([['missing', 428], ['invalid', 400], ['stale', 412]] as const)('If-Match از نوع %s بدون تغییر رد می‌شود', async (kind, status) => {
        const before = snapshot(), row = context.fixture.records.owned.ChangesRequested;
        const pending = call(row.id).set('Authorization', auth());
        if (kind !== 'missing') pending.set('If-Match', kind === 'invalid' ? '*' : encodeEtag({ ...row, version: randomUUID() }));
        await pending.send(operation === 'edit' ? valid : {}).expect(status); expect(snapshot()).toEqual(before);
      });
    });
  }

  for (const [field, maximum] of Object.entries(CONTENT_LIMITS)) {
    it.each([1, maximum])(`AC-405 و AC-407؛ ${field} در حد %i scalar با trim ذخیره می‌شود`, async length => {
      const row = context.fixture.records.owned.ChangesRequested, value = '😀'.repeat(length);
      const response = await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send({ ...valid, [field]: ` \n${value}\t` }).expect(200);
      const edited = context.fixture.requests.find(row.id)!;
      expect(edited).toEqual({ ...row, ...valid, [field]: value, version: expect.any(String) }); expect(edited.version).not.toBe(row.version);
      expect(response.body[field]).toBe(value); expect(response.headers.etag).toBe(encodeEtag(edited));
    });
    it.each([null, ' \t\n', 42, '\ud800', 'ف'.repeat(maximum + 1)])(`AC-405؛ خطای ${field} کل ویرایش را رد می‌کند`, async value => {
      const row = context.fixture.records.owned.ChangesRequested, before = snapshot();
      const response = await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send({ ...valid, [field]: value }).expect(400);
      expect(response.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field, reason: expect.stringMatching(/[\u0600-\u06ff]/) })]));
      expect(snapshot()).toEqual(before);
    });
    it(`AC-405؛ نبود ${field} بدون تغییر رد می‌شود`, async () => {
      const row = context.fixture.records.owned.ChangesRequested, before = snapshot(), body: Record<string, unknown> = { ...valid }; delete body[field];
      await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send(body).expect(400);
      expect(snapshot()).toEqual(before);
    });
  }
  for (const field of ['requesterId', 'status', 'id', 'version'] as const) {
    it.each(['same', 'different'])(`AC-406؛ ${field} با مقدار %s رد کامل دارد`, async mode => {
      const row = context.fixture.records.owned.ChangesRequested, before = snapshot();
      const response = await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send({ ...valid, [field]: mode === 'same' ? row[field] : 'different' }).expect(400);
      expect(response.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field })])); expect(snapshot()).toEqual(before);
    });
  }
  it.each(['{', 'null', '[]', '{"extra":true}'])('AC-405 و AC-406؛ بدنهٔ %s رد می‌شود', async body => {
    const row = context.fixture.records.owned.ChangesRequested, before = snapshot();
    await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).set('Content-Type', 'application/json').send(body).expect(400);
    expect(snapshot()).toEqual(before);
  });
  it('AC-407؛ متن سادهٔ Unicode از HTTP تا Database و GET عیناً حفظ می‌شود', async () => {
    const row = context.fixture.records.owned.ChangesRequested, value = 'فارسی English نیم‌فاصله 👩‍💻 e\u0301 <b>متن</b> **متن**', content = { title: value, description: value, reason: value };
    await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send({ title: ` ${value} `, description: `\n${value}\t`, reason: value }).expect(200);
    const edited = context.fixture.requests.find(row.id)!;
    expect(edited).toEqual({ ...row, ...content, version: expect.any(String) });
    const response = await request(server()).get(`/api/change-requests/${row.id}`).set('Authorization', auth()).expect(200);
    expect(response.body).toMatchObject(content); expect(response.headers.etag).toBe(encodeEtag(edited));
  });
});
