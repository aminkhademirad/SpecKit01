import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createTestApp } from '../fixtures/create-test-app';
import { encodeEtag } from '../../src/http/etag';

const valid = { title: 'عنوان', description: 'شرح تغییر', reason: 'دلیل تغییر' };
describe('US1؛ پذیرش HTTP با بررسی Database', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>;
  beforeEach(async () => { context = await createTestApp(); });
  afterEach(async () => { await context.close(); });
  const server = () => context.app.getHttpServer();
  const auth = (subject = 'requester-a') => `Bearer ${context.fixture.token(subject)}`;
  const snapshot = () => context.fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all();

  it('AC-101، AC-102 و AC-112؛ ایجاد Draft، trim و ویرایش فقط محتوا با هویت واقعی', async () => {
    const response = await request(server()).post('/api/change-requests').set('Authorization', auth()).send({ title: ' عنوان ', description: '\tشرح تغییر\n', reason: ' دلیل تغییر ' }).expect(201);
    const row = context.fixture.requests.find(response.body.id)!;
    expect(row).toMatchObject({ ...valid, requesterId: context.fixture.provisioned.requester.id, status: 'Draft' });
    const after = await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth()).set('If-Match', response.headers.etag!).send({ ...valid, title: 'عنوان تازه' }).expect(200);
    const persisted = context.fixture.requests.find(row.id)!;
    expect(persisted).toEqual({ ...row, title: 'عنوان تازه', version: expect.any(String) });
    expect(persisted.version).not.toBe(row.version);
    expect(after.headers.etag).not.toBe(response.headers.etag);
  });

  it.each(['reviewer-b', 'dual-c', 'reviewer-d'])('AC-103؛ غیرمالک %s هیچ داده‌ای را تغییر نمی‌دهد', async subject => {
    const before = snapshot(), row = context.fixture.records.owned.Draft;
    await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth(subject)).set('If-Match', encodeEtag(row)).send(valid).expect(404);
    expect(snapshot()).toEqual(before);
  });

  it('AC-104 و AC-116؛ هویت نامعتبر و مجوز ناکافی هیچ ایجاد ندارند', async () => {
    const before = snapshot();
    const unauthenticated = await request(server()).post('/api/change-requests').set('Content-Type', 'application/json').send('{').expect(401);
    expect(unauthenticated.body.category).toBe('هویت نامعتبر');
    for (const subject of ['reviewer-b', 'unknown']) await request(server()).post('/api/change-requests').set('Authorization', auth(subject)).send(valid).expect(403);
    expect(snapshot()).toEqual(before);
  });

  it.each([{ requesterId: 'forged' }, { status: 'Approved' }, { status: 'Draft' }, { requesterId: 'self' }, { requesterId: 'self', status: 'Draft' }, { extra: 1 }])('AC-105 و AC-113؛ ورودی محافظت‌شده %p رد کامل می‌شود', async fields => {
    const before = snapshot();
    const body = { ...valid, ...fields, ...('requesterId' in fields && fields.requesterId === 'self' ? { requesterId: context.fixture.provisioned.requester.id } : {}) };
    const response = await request(server()).post('/api/change-requests').set('Authorization', auth()).send(body).expect(400);
    expect(response.body.code).toBe('INVALID_INPUT');
    expect(snapshot()).toEqual(before);
  });

  it.each(['Draft', 'PendingReview', 'ChangesRequested', 'Approved'] as const)('AC-106؛ مالک %s را مشاهده می‌کند', async status => {
    const row = context.fixture.records.owned[status];
    const response = await request(server()).get(`/api/change-requests/${row.id}`).set('Authorization', auth()).expect(200);
    expect(response.body).toMatchObject({ id: row.id, status, title: row.title });
    expect(response.headers.etag).toBe(encodeEtag(row));
  });

  it('AC-107؛ دو ایجاد تکراری مستقل هستند', async () => {
    const before = snapshot();
    const first = await request(server()).post('/api/change-requests').set('Authorization', auth()).send(valid).expect(201);
    const second = await request(server()).post('/api/change-requests').set('Authorization', auth()).send(valid).expect(201);
    expect(first.body.id).not.toBe(second.body.id);
    expect(snapshot()).toHaveLength(before.length + 2);
    expect(context.fixture.requests.find(first.body.id)).toMatchObject({ ...valid, status: 'Draft' });
  });

  it('AC-108؛ DELETE و PATCH وجود ندارند', async () => {
    const before = snapshot(), row = context.fixture.records.owned.Draft;
    await request(server()).delete(`/api/change-requests/${row.id}`).set('Authorization', auth()).expect(404);
    await request(server()).patch(`/api/change-requests/${row.id}`).set('Authorization', auth()).send(valid).expect(404);
    expect(snapshot()).toEqual(before);
  });

  it.each([['title', 200], ['description', 5000], ['reason', 2000]] as const)('AC-109 تا AC-112؛ مرز و trim فیلد %s', async (field, maximum) => {
    for (const length of [1, maximum]) {
      const value = '😀'.repeat(length);
      const response = await request(server()).post('/api/change-requests').set('Authorization', auth()).send({ ...valid, [field]: ` \n${value}\t` }).expect(201);
      expect(context.fixture.requests.find(response.body.id)).toHaveProperty(field, value);
    }
    for (const value of ['', ' \t\n', 'ف'.repeat(maximum + 1), null]) {
      const before = snapshot();
      await request(server()).post('/api/change-requests').set('Authorization', auth()).send({ ...valid, [field]: value }).expect(400);
      expect(snapshot()).toEqual(before);
    }
    const body: Record<string, unknown> = { ...valid }; delete body[field];
    const before = snapshot();
    await request(server()).post('/api/change-requests').set('Authorization', auth()).send(body).expect(400);
    expect(snapshot()).toEqual(before);
  });

  it('AC-114؛ متن ساده حفظ و از GET بازگردانده می‌شود', async () => {
    const text = 'فارسی English نیم‌فاصله 👩‍💻 <b>متن</b> **Markdown**';
    const response = await request(server()).post('/api/change-requests').set('Authorization', auth()).send({ title: text, description: text, reason: text }).expect(201);
    const get = await request(server()).get(response.headers.location!).set('Authorization', auth()).expect(200);
    expect(get.body).toMatchObject({ title: text, description: text, reason: text });
  });

  it('AC-115؛ ویرایش نامعتبر پاسخ فارسی با نام فیلد دارد و هیچ تغییر جزئی ندارد', async () => {
    const row = context.fixture.records.owned.Draft, before = snapshot();
    for (const fields of [{ title: '' }, { status: 'Draft' }, { requesterId: row.requesterId }]) {
      const response = await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send({ ...valid, ...fields }).expect(400);
      expect(response.body.category).toBe('ورودی نامعتبر');
      expect(response.body.errors[0].field).toBeTruthy(); expect(response.body.errors[0].reason).toMatch(/[\u0600-\u06ff]/);
      expect(snapshot()).toEqual(before);
    }
  });

  it('ویرایش PendingReview و Approved و نسخهٔ قدیمی یا غایب رد می‌شود', async () => {
    const before = snapshot();
    for (const status of ['PendingReview', 'Approved'] as const) {
      const row = context.fixture.records.owned[status];
      await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth()).set('Content-Type', 'application/json').send('{').expect(409);
    }
    const draft = context.fixture.records.owned.Draft;
    await request(server()).put(`/api/change-requests/${draft.id}`).set('Authorization', auth()).send(valid).expect(428);
    await request(server()).put(`/api/change-requests/${draft.id}`).set('Authorization', auth()).set('If-Match', encodeEtag({ ...draft, version: randomUUID() })).send(valid).expect(412);
    expect(snapshot()).toEqual(before);
  });

  it('نسخهٔ قدیمی پس از ویرایش موفق، دادهٔ جدیدتر را بازنویسی نمی‌کند', async () => {
    const row = context.fixture.records.owned.Draft;
    const first = await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send({ ...valid, title: 'نسخهٔ تازه' }).expect(200);
    const committed = context.fixture.requests.find(row.id);
    await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send({ ...valid, title: 'نسخهٔ قدیمی' }).expect(412);
    expect(context.fixture.requests.find(row.id)).toEqual(committed);
    expect(first.body.title).toBe('نسخهٔ تازه');
  });

  it('مجوز جاری و محرمانگی بر JSON و header نامعتبر مقدم‌اند', async () => {
    const before = snapshot(), draft = context.fixture.records.owned.Draft;
    let hiddenBody: unknown;
    for (const id of [draft.id, randomUUID(), 'invalid-id']) {
      const response = await request(server()).put(`/api/change-requests/${id}`).set('Authorization', auth('dual-c')).set('If-Match', '*').set('Content-Type', 'application/json').send('{').expect(404);
      hiddenBody ??= response.body; expect(response.body).toEqual(hiddenBody);
      expect(response.headers.etag).toBeUndefined(); expect(response.body.errors).toBeUndefined();
    }
    await request(server()).put(`/api/change-requests/${context.fixture.records.owned.PendingReview.id}`).set('Authorization', auth('reviewer-b')).set('Content-Type', 'application/json').send('{').expect(403);
    const token = auth();
    context.fixture.permissions.execute(context.fixture.configuration.jwtIssuer, 'requester-a', { isRequester: false, isReviewer: false });
    await request(server()).get(`/api/change-requests/${draft.id}`).set('Authorization', token).expect(200);
    await request(server()).put(`/api/change-requests/${draft.id}`).set('Authorization', token).set('Content-Type', 'application/json').send('{').expect(403);
    await request(server()).post('/api/change-requests').set('Authorization', token).send(valid).expect(403);
    expect(snapshot()).toEqual(before);
  });

  it.each(['Draft', 'PendingReview', 'ChangesRequested', 'Approved'] as const)('Reviewer فقط PendingReview دیگران را از مسیر واقعی GET می‌بیند؛ %s', async status => {
    const row = context.fixture.records.owned[status];
    await request(server()).get(`/api/change-requests/${row.id}`).set('Authorization', auth('reviewer-b')).expect(status === 'PendingReview' ? 200 : 404);
  });

  it('Unicode ناسالم در HTTP بدون هیچ ثبت یا ویرایش رد می‌شود', async () => {
    const before = snapshot(), row = context.fixture.records.owned.Draft;
    await request(server()).post('/api/change-requests').set('Authorization', auth()).send({ ...valid, title: '\ud800' }).expect(400);
    await request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send({ ...valid, reason: '\udfff' }).expect(400);
    expect(snapshot()).toEqual(before);
  });
});
