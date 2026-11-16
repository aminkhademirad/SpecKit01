import 'reflect-metadata';
import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp } from '../fixtures/create-test-app';
import { SqliteUnitOfWork } from '../../src/infrastructure/sqlite/sqlite-unit-of-work';
import { SqliteUserStore } from '../../src/infrastructure/sqlite/sqlite-user-store';
import { SqliteChangeRequestStore } from '../../src/infrastructure/sqlite/sqlite-change-request-store';
import { assertCanCreate, assertCanOperate } from '../../src/domain/authorization-policy';
import { DomainError, type ErrorCode } from '../../src/domain/errors';
import type { Identity } from '../../src/domain/user';
import { encodeEtag, assertExpectedVersion } from '../../src/http/etag';
import { MAX_BODY_BYTES } from '../../src/http/configure-http';
import { DeferredJsonBody, ParseJsonBodyPipe } from '../../src/http/pipes/parse-json-body.pipe';
import type { AuthenticatedRequest } from '../../src/http/guards/authentication.guard';

class FoundationApplication {
  constructor(private readonly unit: SqliteUnitOfWork, private readonly users: SqliteUserStore, private readonly requests: SqliteChangeRequestStore) {}
  check(identity: Identity, id: string | undefined, body: DeferredJsonBody, header?: string | string[]): { accepted: boolean } {
    return this.unit.write(() => {
      const user = this.users.find(identity.issuer, identity.subject);
      if (id) {
        const row = this.requests.find(id);
        assertCanOperate(identity, user, row, 'Edit');
        body.unwrap(['title', 'description', 'reason']);
        assertExpectedVersion(header, row!);
      } else {
        assertCanCreate(identity, user);
        body.unwrap(['title', 'description', 'reason']);
      }
      return { accepted: true };
    });
  }
}

@Controller('foundation')
class FoundationController {
  constructor(@Inject(FoundationApplication) private readonly application: FoundationApplication) {}
  @Get('errors/:code')
  failure(@Param('code') code: string): never {
    if (code === 'raw') throw new Error('SQL PRIVATE_INTERNAL_VALUE');
    throw new DomainError(code as ErrorCode, [{ field: 'title', reason: 'عنوان معتبر نیست.' }]);
  }
  @Get(':id')
  visible(@Req() req: AuthenticatedRequest) { return { id: req.visibleRequest!.id, status: req.visibleRequest!.status }; }
  @Post()
  createProbe(@Req() req: AuthenticatedRequest, @Body(new ParseJsonBodyPipe()) body: DeferredJsonBody) {
    return this.application.check(req.identity!, undefined, body);
  }
  @Post(':id')
  resourceProbe(@Req() req: AuthenticatedRequest, @Body(new ParseJsonBodyPipe()) body: DeferredJsonBody) {
    return this.application.check(req.identity!, req.params.id, body, req.headers['if-match']);
  }
}

describe('HTTP واقعی زیرساخت؛ Controller آزمایشی فقط در test', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    context = await createTestApp([FoundationController], [{ provide: FoundationApplication,
      useFactory: (unit: SqliteUnitOfWork, users: SqliteUserStore, requests: SqliteChangeRequestStore) => new FoundationApplication(unit, users, requests),
      inject: [SqliteUnitOfWork, SqliteUserStore, SqliteChangeRequestStore] }]);
  });
  afterAll(async () => { await context.close(); });
  const server = () => context.app.getHttpServer();
  const bearer = (subject = 'requester-a') => `Bearer ${context.fixture.token(subject)}`;

  it('401 پیش از parsing و بدون جزئیات منبع است', async () => {
    const response = await request(server()).post('/foundation/not-a-uuid').set('Content-Type', 'application/json').send('{').expect(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');
    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it.each(['Draft', 'PendingReview', 'ChangesRequested', 'Approved'] as const)('مالک می‌تواند %s را ببیند', async status => {
    const row = context.fixture.records.owned[status];
    const response = await request(server()).get(`/foundation/${row.id}`).set('Authorization', bearer()).expect(200);
    expect(response.body.status).toBe(status);
  });

  it.each(['Draft', 'PendingReview', 'ChangesRequested', 'Approved'] as const)('دامنهٔ مشاهدهٔ Reviewer در %s درست است', async status => {
    const row = context.fixture.records.owned[status];
    await request(server()).get(`/foundation/${row.id}`).set('Authorization', bearer('reviewer-b')).expect(status === 'PendingReview' ? 200 : 404);
  });

  it.each(['{', '{"requesterId":"forged"}', '{"title":12}', '{}'])('منبع پنهان و ناموجود با بدنهٔ %s پاسخ یکسان دارند', async body => {
    const responses = [];
    for (const id of [context.fixture.records.dual.Draft.id, randomUUID(), 'invalid-id']) {
      responses.push(await request(server()).post(`/foundation/${id}`).set('Authorization', bearer()).set('If-Match', 'invalid').set('Content-Type', 'application/json').send(body).expect(404));
    }
    for (const response of responses) {
      expect(response.body).toEqual(responses[0]!.body);
      expect(response.headers.etag).toBeUndefined(); expect(response.headers.location).toBeUndefined();
      expect(response.body.errors).toBeUndefined();
    }
  });

  it('برای منبع قابل مشاهده، مجوز عملیات پیش از خطای JSON بررسی می‌شود', async () => {
    await request(server()).post(`/foundation/${context.fixture.records.owned.PendingReview.id}`).set('Authorization', bearer('reviewer-b')).set('Content-Type', 'application/json').send('{').expect(403);
  });

  it('JSON نامعتبر و خصوصیت اضافی پس از بررسی مجوز با نام فیلد رد می‌شوند', async () => {
    const row = context.fixture.records.owned.Draft;
    for (const body of ['{', '{"requesterId":"correct-or-forged"}', '{"status":"Draft"}']) {
      const response = await request(server()).post(`/foundation/${row.id}`).set('Authorization', bearer()).set('If-Match', encodeEtag(row)).set('Content-Type', 'application/json').send(body).expect(400);
      expect(response.body.errors[0].field).toBeTruthy();
    }
    expect(context.fixture.requests.find(row.id)).toEqual(row);
  });

  it('پیش‌شرط غایب، نامعتبر و قدیمی را جدا می‌کند', async () => {
    const row = context.fixture.records.owned.Draft;
    const post = () => request(server()).post(`/foundation/${row.id}`).set('Authorization', bearer());
    await post().send({}).expect(428);
    await post().set('If-Match', '*').send({}).expect(400);
    await post().set('If-Match', encodeEtag({ ...row, version: randomUUID() })).send({}).expect(412);
    await post().set('If-Match', encodeEtag(row)).send({}).expect(201);
  });

  it('D-08؛ JWT معتبر ناشناخته ایجاد را 403 و منبع را 404 می‌کند', async () => {
    await request(server()).post('/foundation').set('Authorization', bearer('unknown')).send({}).expect(403);
    for (const id of [context.fixture.records.owned.PendingReview.id, randomUUID()]) {
      await request(server()).get(`/foundation/${id}`).set('Authorization', bearer('unknown')).expect(404);
    }
    expect(context.fixture.users.find(context.fixture.configuration.jwtIssuer, 'unknown')).toBeNull();
  });

  it('D-07؛ سقف دقیق عبور می‌کند و یک بایت بیشتر مستقل از هویت و منبع 413 می‌دهد', async () => {
    const overhead = Buffer.byteLength(JSON.stringify({ title: '' }));
    const exact = JSON.stringify({ title: 'x'.repeat(MAX_BODY_BYTES - overhead) });
    expect(Buffer.byteLength(exact)).toBe(MAX_BODY_BYTES);
    await request(server()).post('/foundation').set('Authorization', bearer()).set('Content-Type', 'application/json').send(exact).expect(201);
    let expected: unknown;
    for (const id of [context.fixture.records.owned.Draft.id, context.fixture.records.dual.Draft.id, randomUUID()]) {
      for (const authorization of [bearer(), 'Bearer invalid']) {
        const response = await request(server()).post(`/foundation/${id}`).set('Authorization', authorization).set('Content-Type', 'application/json').send(exact + ' ').expect(413);
        expected ??= response.body;
        expect(response.body).toEqual(expected);
        expect(response.body).toEqual({ code: 'PAYLOAD_TOO_LARGE', category: 'خطای فنی', message: 'حجم بدنهٔ درخواست بیش از حد مجاز است' });
        expect(response.headers.etag).toBeUndefined(); expect(response.headers.location).toBeUndefined();
        expect(response.headers['cache-control']).toBe('no-store');
      }
    }
    expect(context.fixture.database.connection.prepare('SELECT count(*) AS count FROM change_requests').get()).toEqual({ count: 8 });
  });

  it.each([
    ['UNAUTHENTICATED', 401], ['REQUEST_UNAVAILABLE', 404], ['FORBIDDEN', 403], ['INVALID_INPUT', 400],
    ['INVALID_STATE', 409], ['CONCURRENCY_CONFLICT', 412], ['VERSION_REQUIRED', 428], ['PAYLOAD_TOO_LARGE', 413],
    ['SERVICE_UNAVAILABLE', 503], ['INTERNAL_ERROR', 500], ['raw', 500],
  ] as const)('خطای %s را فارسی و بدون نشت داخلی برمی‌گرداند', async (code, status) => {
    const response = await request(server()).get(`/foundation/errors/${code}`).set('Authorization', bearer()).expect(status);
    expect(response.body.message).toMatch(/[\u0600-\u06ff]/);
    expect(response.text).not.toContain('PRIVATE_INTERNAL_VALUE');
    expect(response.text).not.toContain('stack');
    if (status !== 400 && status !== 428) expect(response.body.errors).toBeUndefined();
  });
});
