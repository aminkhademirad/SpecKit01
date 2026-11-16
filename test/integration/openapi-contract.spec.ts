import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import request from 'supertest';
import { createTestApp } from '../fixtures/create-test-app';
import { CONTENT_LIMITS } from '../../src/domain/change-request';
import { encodeEtag } from '../../src/http/etag';
import { MAX_BODY_BYTES } from '../../src/http/configure-http';

const contract = JSON.parse(readFileSync('specs/001-change-request-management/contracts/openapi.json', 'utf8'));
const prose = readFileSync('specs/001-change-request-management/contracts/http-api.md', 'utf8');
const ajv = new Ajv2020({ strict: false, allErrors: true });
ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
ajv.addSchema({ ...contract, $id: 'changeflow' });
const resolveRef = (value: any): any => value.$ref ? value.$ref.slice(2).split('/').reduce((node: any, key: string) => node[key], contract) : value;
const valid = { title: 'عنوان', description: 'شرح', reason: 'دلیل' };
const schema = (name: string) => ajv.compile({ $ref: `changeflow#/components/schemas/${name}` });
const matchesResponse = (path: string, method: string, response: request.Response) => {
  const expected = resolveRef(contract.paths[path][method].responses[String(response.status)]);
  expect(expected).toBeDefined();
  for (const [name, raw] of Object.entries(expected.headers ?? {})) {
    const header = resolveRef(raw); const value = response.headers[name.toLowerCase()];
    expect(value).toBeDefined();
    const validate = ajv.compile(header.schema); expect(validate(value)).toBe(true);
  }
  if (expected.content) {
    const target = expected.content['application/json'].schema;
    const check = target.$ref ? ajv.compile({ $ref: `changeflow${target.$ref}` }) : ajv.compile(target);
    expect(check(response.body)).toBe(true);
  } else expect(response.text).toBe('');
};

describe('تطبیق قرارداد واقعی با OpenAPI و قرارداد فارسی', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>;
  beforeEach(async () => { context = await createTestApp(); });
  afterEach(async () => { await context.close(); });
  const server = () => context.app.getHttpServer();
  const auth = (subject = 'requester-a') => `Bearer ${context.fixture.token(subject)}`;
  const snapshot = () => context.fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all();

  it('شش عملیات مصوب با نمایش، Header و پاسخ واقعی مطابق Schema هستند', async () => {
    const pairs = Object.entries(contract.paths).flatMap(([path, methods]) => Object.keys(methods as object).map(method => `${method.toUpperCase()} ${path}`));
    expect(pairs.sort()).toEqual(['POST /api/change-requests', 'GET /api/change-requests/{id}', 'PUT /api/change-requests/{id}', 'POST /api/change-requests/{id}/submit', 'POST /api/change-requests/{id}/approve', 'POST /api/change-requests/{id}/request-changes'].sort());
    for (const pair of pairs) expect(prose).toContain(pair);
    const created = await request(server()).post('/api/change-requests').set('Authorization', auth()).send(valid).expect(201);
    matchesResponse('/api/change-requests', 'post', created);
    const url = `/api/change-requests/${created.body.id}`;
    const get = await request(server()).get(url).set('Authorization', auth()).expect(200); matchesResponse('/api/change-requests/{id}', 'get', get);
    const edit = await request(server()).put(url).set('Authorization', auth()).set('If-Match', get.headers.etag!).send({ ...valid, title: 'تازه' }).expect(200); matchesResponse('/api/change-requests/{id}', 'put', edit);
    const submit = await request(server()).post(`${url}/submit`).set('Authorization', auth()).set('If-Match', edit.headers.etag!).send({}).expect(204); matchesResponse('/api/change-requests/{id}/submit', 'post', submit);
    for (const action of ['approve', 'request-changes']) {
      const row = action === 'approve' ? context.fixture.requests.find(created.body.id)! : context.fixture.records.dual.PendingReview;
      const response = await request(server()).post(`/api/change-requests/${row.id}/${action}`).set('Authorization', auth('reviewer-b')).set('If-Match', encodeEtag(row)).send({}).expect(204);
      matchesResponse(`/api/change-requests/{id}/${action}`, 'post', response); expect(response.headers.etag).toBeUndefined(); expect(response.headers.location).toBeUndefined();
    }
  });

  for (const [field, maximum] of Object.entries(CONTENT_LIMITS)) {
    it.each(['ف', '😀'])(`AC-112 و AC-405؛ حدود ${field} برای %s در ایجاد و ویرایش با Schema خام سازگار است`, async scalar => {
      const validate = schema('WriteChangeRequest');
      expect(contract.components.schemas.WriteChangeRequest.properties[field].maxLength).toBeUndefined();
      for (const operation of ['create', 'edit']) {
        const row = context.fixture.records.owned.ChangesRequested;
        const call = () => operation === 'create' ? request(server()).post('/api/change-requests').set('Authorization', auth()) : request(server()).put(`/api/change-requests/${row.id}`).set('Authorization', auth()).set('If-Match', encodeEtag(context.fixture.requests.find(row.id)!));
        const body = { ...valid, [field]: ` \n${scalar.repeat(maximum)}\t ` };
        expect(validate(body)).toBe(true);
        const response = await call().send(body).expect(operation === 'create' ? 201 : 200);
        expect(context.fixture.requests.find(response.body.id)).toHaveProperty(field, scalar.repeat(maximum));
        for (const value of [scalar.repeat(maximum + 1), ' \t\n']) {
          const before = snapshot(); const invalid = await call().send({ ...valid, [field]: value }).expect(400);
          matchesResponse(operation === 'create' ? '/api/change-requests' : '/api/change-requests/{id}', operation === 'create' ? 'post' : 'put', invalid);
          expect(invalid.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field })])); expect(snapshot()).toEqual(before);
        }
      }
    });
  }

  it.each(['create', 'edit', 'submit', 'approve', 'request-changes'])('D-07؛ سقف دقیق بدنه و 413 در عملیات %s با قرارداد برابرند', async action => {
    const fixture = context.fixture, row = action === 'approve' || action === 'request-changes' ? fixture.records.owned.PendingReview : fixture.records.owned.Draft;
    const path = action === 'create' ? '/api/change-requests' : action === 'edit' ? '/api/change-requests/{id}' : `/api/change-requests/{id}/${action}`;
    const method = action === 'edit' ? 'put' : 'post';
    const call = () => action === 'create' ? request(server()).post('/api/change-requests') : action === 'edit' ? request(server()).put(`/api/change-requests/${row.id}`) : request(server()).post(`/api/change-requests/${row.id}/${action}`);
    const raw = action === 'create' || action === 'edit' ? JSON.stringify(valid) : '{}';
    const exact = raw + ' '.repeat(MAX_BODY_BYTES - Buffer.byteLength(raw));
    expect(Buffer.byteLength(exact)).toBe(131072);
    const before = snapshot();
    const oversized = await call().set('Authorization', 'Bearer invalid').set('Content-Type', 'application/json').send(exact + ' ').expect(413);
    matchesResponse(path, method, oversized); expect(oversized.body).toEqual(resolveRef(contract.paths[path][method].responses['413']).content['application/json'].example);
    expect(oversized.headers.etag).toBeUndefined(); expect(oversized.headers.location).toBeUndefined(); expect(snapshot()).toEqual(before);
    const accepted = await call().set('Authorization', auth(action === 'approve' || action === 'request-changes' ? 'reviewer-b' : 'requester-a')).set('If-Match', encodeEtag(row)).set('Content-Type', 'application/json').send(exact).expect(action === 'create' ? 201 : action === 'edit' ? 200 : 204);
    matchesResponse(path, method, accepted);
  });

  it('AC-114؛ JSON escape معتبر پس از decoding همان متن Unicode است', async () => {
    const body = '{"title":"\\u0639\\u0646\\u0648\\u0627\\u0646 \\ud83d\\ude00","description":"شرح","reason":"دلیل"}';
    const response = await request(server()).post('/api/change-requests').set('Authorization', auth()).set('Content-Type', 'application/json').send(body).expect(201);
    expect(context.fixture.requests.find(response.body.id)!.title).toBe('عنوان 😀'); matchesResponse('/api/change-requests', 'post', response);
  });

  it('AC-108 و AC-206؛ مسیرهای خارج از محدوده وجود ندارند', async () => {
    const before = snapshot(), id = context.fixture.records.owned.Draft.id;
    await request(server()).get('/api/change-requests').set('Authorization', auth()).expect(404);
    await request(server()).delete(`/api/change-requests/${id}`).set('Authorization', auth()).expect(404);
    await request(server()).patch(`/api/change-requests/${id}`).set('Authorization', auth()).send(valid).expect(404);
    for (const url of ['/api/login', '/api/roles', `/api/change-requests/${id}/cancel`]) await request(server()).post(url).set('Authorization', auth()).send({}).expect(404);
    expect(snapshot()).toEqual(before);
  });

  it('شش دستهٔ خطای عمومی و پیش‌شرط با Schema پاسخ تطبیق دارند', async () => {
    const row = context.fixture.records.owned.Draft, url = `/api/change-requests/${row.id}`;
    const samples = [
      await request(server()).get(url).expect(401),
      await request(server()).get(`/api/change-requests/${context.fixture.records.dual.Draft.id}`).set('Authorization', auth()).expect(404),
      await request(server()).post(`/api/change-requests/${context.fixture.records.dual.PendingReview.id}/approve`).set('Authorization', auth('dual-c')).expect(403),
      await request(server()).put(url).set('Authorization', auth()).send(valid).expect(428),
      await request(server()).put(url).set('Authorization', auth()).set('If-Match', encodeEtag(row)).send({}).expect(400),
      await request(server()).post(`/api/change-requests/${context.fixture.records.owned.Approved.id}/submit`).set('Authorization', auth()).expect(409),
      await request(server()).put(url).set('Authorization', auth()).set('If-Match', encodeEtag(context.fixture.records.dual.Draft)).send(valid).expect(412),
    ];
    for (const response of samples) { const validate = schema(response.status === 404 ? 'UnavailableError' : response.status === 400 || response.status === 428 ? 'InputError' : 'ApiError'); expect(validate(response.body)).toBe(true); expect(response.headers['cache-control']).toBe('no-store'); }
  });
});
