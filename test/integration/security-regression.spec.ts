import { randomBytes, randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../fixtures/create-test-app';
import { CreateChangeRequest } from '../../src/application/create-change-request';
import { UpdateChangeRequest } from '../../src/application/update-change-request';
import { SubmitChangeRequest } from '../../src/application/submit-change-request';
import { ApproveChangeRequest } from '../../src/application/approve-change-request';
import { RequestChanges } from '../../src/application/request-changes';
import { encodeEtag } from '../../src/http/etag';
import { SqliteUserStore } from '../../src/infrastructure/sqlite/sqlite-user-store';

const valid = { title: 'عنوان', description: 'شرح', reason: 'دلیل' };
describe('بازبینی مستقل امنیت با Bootstrap واقعی', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>;
  beforeEach(async () => { context = await createTestApp(); });
  afterEach(async () => { await context.close(); });
  const server = () => context.app.getHttpServer();
  const snapshot = () => ({ users: context.fixture.database.connection.prepare('SELECT * FROM users ORDER BY id').all(), requests: context.fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all() });
  const token = (subject: string, payload: object = {}, overrides: Record<string, unknown> = {}) => new JwtService().sign(payload, { secret: context.fixture.configuration.jwtSecret, algorithm: 'HS256', issuer: context.fixture.configuration.jwtIssuer, audience: context.fixture.configuration.jwtAudience, subject, expiresIn: '5m', ...overrides });
  const assertPublic = (response: request.Response) => {
    expect(response.text).not.toContain(context.fixture.configuration.jwtSecret);
    expect(response.text).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|SQLITE_|\bSELECT\b|\bUPDATE\b|Error:|\bat \w+\s*\(/);
    expect(response.body.stack).toBeUndefined(); expect(response.headers['cache-control']).toBe('no-store');
  };

  it('D-08؛ JWT معتبر با role claim ولی بدون نگاشت محلی هیچ داده یا نقشی نمی‌سازد', async () => {
    const before = snapshot(), jwt = token('unmapped', { roles: ['Requester', 'Reviewer'], isRequester: true, isReviewer: true });
    const created = await request(server()).post('/api/change-requests').set('Authorization', `Bearer ${jwt}`).send(valid).expect(403); assertPublic(created);
    for (const id of [context.fixture.records.owned.PendingReview.id, randomUUID()]) {
      for (const action of ['get', 'edit', 'submit', 'approve', 'request-changes']) {
        const url = `/api/change-requests/${id}`, call = action === 'get' ? request(server()).get(url) : action === 'edit' ? request(server()).put(url) : request(server()).post(`${url}/${action}`);
        const response = await call.set('Authorization', `Bearer ${jwt}`).set('If-Match', '*').set('Content-Type', 'application/json').send('{').expect(404);
        expect(response.body).toEqual({ code: 'REQUEST_UNAVAILABLE', category: 'درخواست در دسترس نیست', message: 'درخواست در دسترس نیست.' }); assertPublic(response);
      }
    }
    expect(snapshot()).toEqual(before);
  });

  it.each(['signature', 'issuer', 'audience', 'expired', 'subject'] as const)('AC-104 و AC-116؛ JWT با %s نامعتبر هیچ تغییری نمی‌دهد', async kind => {
    const before = snapshot();
    const overrides = kind === 'signature' ? { secret: randomBytes(32).toString('base64url') } : kind === 'issuer' ? { issuer: 'other' } : kind === 'audience' ? { audience: 'other' } : kind === 'expired' ? { expiresIn: -1 } : {};
    const jwt = token(kind === 'subject' ? '' : 'requester-a', {}, overrides);
    const response = await request(server()).post('/api/change-requests').set('Authorization', `Bearer ${jwt}`).set('Content-Type', 'application/json').send('{').expect(401);
    assertPublic(response); expect(response.headers['www-authenticate']).toBe('Bearer'); expect(snapshot()).toEqual(before);
  });

  it.each(['approve', 'request-changes'])('AC-303، AC-311 و AC-314؛ دو نقش و Header جعلی مالک را برای %s مجاز نمی‌کنند', async action => {
    const row = context.fixture.records.dual.PendingReview, before = snapshot();
    const response = await request(server()).post(`/api/change-requests/${row.id}/${action}`).set('Authorization', `Bearer ${token('dual-c')}`).set('X-User-Id', context.fixture.provisioned.reviewer.id).set('X-Role', 'Reviewer').set('If-Match', encodeEtag(row)).send({}).expect(403);
    assertPublic(response); expect(response.body.message).toContain('خود'); expect(snapshot()).toEqual(before);
  });

  it('مجوز لغوشده با role claim قدیمی یا دسترسی قبلی بازنمی‌گردد', async () => {
    const row = context.fixture.records.owned.PendingReview, jwt = token('reviewer-b', { roles: ['Reviewer'] });
    await request(server()).get(`/api/change-requests/${row.id}`).set('Authorization', `Bearer ${jwt}`).expect(200);
    context.fixture.permissions.execute(context.fixture.configuration.jwtIssuer, 'reviewer-b', { isRequester: false, isReviewer: false });
    const before = snapshot();
    const response = await request(server()).post(`/api/change-requests/${row.id}/approve`).set('Authorization', `Bearer ${jwt}`).set('If-Match', encodeEtag(row)).send({}).expect(404);
    assertPublic(response); expect(snapshot()).toEqual(before);
  });

  it('فراخوانی مستقیم Application نیز مجوز، مالکیت و Self-Approval را اعمال می‌کند', () => {
    const fixture = context.fixture, before = snapshot(), draft = fixture.records.owned.Draft, dual = fixture.records.dual.PendingReview;
    expect(() => context.app.get(CreateChangeRequest).execute(fixture.identity('reviewer-b'), () => valid)).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
    for (const service of [UpdateChangeRequest, SubmitChangeRequest] as const) expect(() => context.app.get(service).execute(fixture.identity('dual-c'), draft.id, () => valid, () => draft)).toThrow(expect.objectContaining({ code: 'REQUEST_UNAVAILABLE' }));
    for (const service of [ApproveChangeRequest, RequestChanges] as const) expect(() => context.app.get(service).execute(fixture.identity('dual-c'), dual.id, () => ({}), () => dual)).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(snapshot()).toEqual(before);
  });

  it('شکست Database به نبود نگاشت تعبیر نمی‌شود و پاسخ داخلی را افشا نمی‌کند', async () => {
    jest.spyOn(context.app.get(SqliteUserStore), 'find').mockImplementationOnce(() => { throw new Error('SQLITE_INTERNAL SELECT secret; stack خصوصی'); });
    const before = snapshot();
    const response = await request(server()).post('/api/change-requests').set('Authorization', `Bearer ${token('requester-a')}`).send(valid).expect(500);
    expect(response.body.code).toBe('INTERNAL_ERROR'); assertPublic(response); expect(snapshot()).toEqual(before);
  });
});
