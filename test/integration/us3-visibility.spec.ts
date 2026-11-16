import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp } from '../fixtures/create-test-app';
import { encodeEtag } from '../../src/http/etag';
import { MAX_BODY_BYTES } from '../../src/http/configure-http';

const statuses = ['Draft', 'PendingReview', 'ChangesRequested', 'Approved'] as const;
const actors = ['requester-a', 'requester-other', 'reviewer-b', 'dual-c'] as const;
const hiddenCases = actors.flatMap(subject => statuses.filter(status => subject === 'requester-other' || (subject !== 'requester-a' && status !== 'PendingReview')).map(status => ({ subject, status })));

describe('US3؛ ماتریس محرمانگی با bootstrap مشترک', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    context = await createTestApp();
    context.fixture.unit.write(() => context.fixture.users.provision(context.fixture.configuration.jwtIssuer, 'requester-other', { isRequester: true, isReviewer: false }));
  });
  afterAll(async () => { await context.close(); });
  const server = () => context.app.getHttpServer();
  const auth = (subject: string) => `Bearer ${context.fixture.token(subject)}`;
  const snapshot = () => context.fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all();
  const operation = (kind: string, id: string) => {
    const url = `/api/change-requests/${id}`;
    return kind === 'get' ? request(server()).get(url) : kind === 'put' ? request(server()).put(url) : request(server()).post(`${url}/${kind}`);
  };

  it.each(actors.flatMap(subject => statuses.map(status => ({ subject, status }))))('AC-106، AC-308 و AC-310؛ مشاهدهٔ $subject در $status', async ({ subject, status }) => {
    const row = context.fixture.records.owned[status];
    const allowed = subject === 'requester-a' || (subject !== 'requester-other' && status === 'PendingReview');
    const response = await operation('get', row.id).set('Authorization', auth(subject)).expect(allowed ? 200 : 404);
    if (allowed) expect(response.body).toMatchObject({ id: row.id, title: row.title, status });
    else expect(Object.keys(response.body).sort()).toEqual(['category', 'code', 'message']);
  });

  it.each(hiddenCases)('AC-309، AC-313 و AC-316؛ جفت پنهان/ناموجود برای $subject در $status', async ({ subject, status }) => {
    const row = context.fixture.records.owned[status], before = snapshot(), missing = randomUUID();
    for (const kind of ['get', 'put', 'submit', 'approve', 'request-changes']) {
      for (const body of ['{', '{"title":12}', JSON.stringify({ requesterId: row.requesterId, status: row.status })]) {
        for (const header of ['missing', 'invalid', 'valid']) {
          const replies = [];
          for (const id of [row.id, missing]) {
            const pending = operation(kind, id).set('Authorization', auth(subject)).set('Content-Type', 'application/json');
            if (header !== 'missing') pending.set('If-Match', header === 'invalid' ? '*' : encodeEtag({ id, version: row.version }));
            replies.push(await pending.send(body).expect(404));
          }
          expect(replies[0]!.text).toBe(replies[1]!.text);
          for (const response of replies) {
            expect(response.headers.etag).toBeUndefined(); expect(response.headers.location).toBeUndefined();
            expect(Object.keys(response.body).sort()).toEqual(['category', 'code', 'message']);
            expect(response.text).not.toContain(row.id); expect(response.text).not.toContain(row.title); expect(response.text).not.toContain(row.version);
            expect(response.headers['cache-control']).toBe('no-store');
          }
        }
      }
    }
    expect(snapshot()).toEqual(before);
  }, 15000);

  it('401 برای همهٔ عملیات پیش از JSON، DTO و If-Match نامعتبر می‌آید', async () => {
    const before = snapshot();
    for (const kind of ['get', 'put', 'submit', 'approve', 'request-changes']) {
      const response = await operation(kind, context.fixture.records.owned.PendingReview.id).set('Authorization', 'Bearer invalid').set('If-Match', '*').set('Content-Type', 'application/json').send('{').expect(401);
      expect(response.headers['www-authenticate']).toBe('Bearer'); expect(response.body.errors).toBeUndefined();
    }
    expect(snapshot()).toEqual(before);
  });

  it('D-07؛ 413 مستقل از هویت و وجود یا visibility درخواست است', async () => {
    const before = snapshot(); let expected: unknown;
    for (const kind of ['get', 'put', 'submit', 'approve', 'request-changes']) {
      for (const id of [context.fixture.records.owned.PendingReview.id, context.fixture.records.owned.Draft.id, randomUUID()]) {
        for (const token of [auth('reviewer-b'), 'Bearer invalid']) {
          const response = await operation(kind, id).set('Authorization', token).set('Content-Type', 'application/json').send(' '.repeat(MAX_BODY_BYTES + 1)).expect(413);
          expected ??= response.body; expect(response.body).toEqual(expected);
          expect(response.body.code).toBe('PAYLOAD_TOO_LARGE'); expect(response.headers.etag).toBeUndefined(); expect(response.headers.location).toBeUndefined();
          expect(response.body.errors).toBeUndefined();
        }
      }
    }
    expect(snapshot()).toEqual(before);
  });
});
