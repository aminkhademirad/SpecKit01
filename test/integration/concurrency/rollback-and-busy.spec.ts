import request from 'supertest';
import { ControlledWorker, recordRace } from '../../fixtures/concurrency-coordinator';
import { createTestApp } from '../../fixtures/create-test-app';
import { encodeEtag } from '../../../src/http/etag';

describe('US5؛ Rollback و قفل واقعی SQLite', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>; let workers: ControlledWorker[];
  beforeEach(async () => { context = await createTestApp(); workers = []; });
  afterEach(async () => { await Promise.all(workers.map(worker => worker.close())); await context.close(); });
  it.each(['edit', 'submit', 'approve', 'request-changes'] as const)('AC-505؛ شکست پس از نوشتن %s پیش از Commit همهٔ تغییر را برمی‌گرداند', async operation => {
    const fixture = context.fixture, row = operation === 'edit' || operation === 'submit' ? fixture.records.owned.Draft : fixture.records.owned.PendingReview;
    const worker = new ControlledWorker({ filename: fixture.filename, issuer: fixture.configuration.jwtIssuer, subject: operation === 'edit' || operation === 'submit' ? 'requester-a' : 'reviewer-b', id: row.id, version: row.version, operation, failBeforeCommit: true, content: { title: 'نباید بماند', description: 'شرح', reason: 'دلیل' } }); workers.push(worker);
    await worker.phase('ready'); worker.start(); const result = await worker.phase('result');
    expect(result.code).toBe('INTERNAL_ERROR'); expect(worker.events.some(event => event.type === 'written')).toBe(true);
    expect(worker.events.some(event => event.type === 'committed')).toBe(false); expect(result.row).toEqual(row); expect(fixture.requests.find(row.id)).toEqual(row);
    recordRace(`Rollback ${operation}`, workers, fixture.requests.find(row.id));
  }, 30000);

  it('AC-505 و AC-508؛ قفل مستقل پس از مهلت مصوب 503 دارد، نه 412 یا موفقیت', async () => {
    const fixture = context.fixture, row = fixture.records.owned.Draft;
    const common = { filename: fixture.filename, issuer: fixture.configuration.jwtIssuer, subject: 'requester-a', id: row.id, version: row.version };
    const holder = new ControlledWorker({ ...common, operation: 'lock', holdAfterLock: true });
    const blocked = new ControlledWorker({ ...common, operation: 'submit' }); workers.push(holder, blocked);
    const ready = await Promise.all(workers.map(worker => worker.phase('ready'))); expect(ready.map(event => event.busyTimeout)).toEqual([1000, 1000]);
    holder.start(); await holder.phase('locked'); blocked.start();
    const result = await blocked.phase('result'); expect(result.code).toBe('SERVICE_UNAVAILABLE'); expect(result.elapsedMs).toBeGreaterThanOrEqual(900);
    expect(blocked.events.some(event => event.type === 'locked')).toBe(false);
    const response = await request(context.app.getHttpServer()).post(`/api/change-requests/${row.id}/submit`).set('Authorization', `Bearer ${fixture.token('requester-a')}`).set('If-Match', encodeEtag(row)).send({}).expect(503);
    expect(response.body.code).toBe('SERVICE_UNAVAILABLE'); expect(response.headers.etag).toBeUndefined(); expect(response.headers['cache-control']).toBe('no-store');
    expect(fixture.requests.find(row.id)).toEqual(row);
    holder.release(1); expect((await holder.phase('result')).code).toBe('OK');
    recordRace('BUSY واقعی و HTTP 503', workers, { response: response.body, request: fixture.requests.find(row.id) });
  }, 30000);
});
