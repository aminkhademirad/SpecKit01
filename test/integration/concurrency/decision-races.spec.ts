import { ControlledWorker, recordRace } from '../../fixtures/concurrency-coordinator';
import { createDatabaseFixture, type DatabaseFixture } from '../../fixtures/database-fixture';

describe('US5؛ تصمیم‌های متناقض با دو Reviewer', () => {
  let fixture: DatabaseFixture; let workers: ControlledWorker[];
  beforeEach(() => { fixture = createDatabaseFixture(); workers = []; });
  afterEach(async () => { await Promise.all(workers.map(worker => worker.close())); fixture.close(); });
  it.each(['approve', 'request-changes'] as const)('AC-502 و AC-505؛ نخستین تصمیم %s تنها انتقال نهایی است', async operation => {
    const row = fixture.records.owned.PendingReview;
    const common = { filename: fixture.filename, issuer: fixture.configuration.jwtIssuer, id: row.id, version: row.version };
    const first = new ControlledWorker({ ...common, subject: 'reviewer-b', operation, holdBeforeCommit: true });
    const second = new ControlledWorker({ ...common, subject: 'reviewer-d', operation: operation === 'approve' ? 'request-changes' : 'approve' }); workers.push(first, second);
    const ready = await Promise.all(workers.map(worker => worker.phase('ready'))); expect(ready.map(event => event.row)).toEqual([row, row]);
    first.start(); await first.phase('written'); second.start(); await second.phase('attempt'); first.release(2);
    const results = await Promise.all(workers.map(worker => worker.phase('result')));
    expect(results.map(event => event.code)).toEqual(['OK', 'REQUEST_UNAVAILABLE']);
    const final = fixture.requests.find(row.id)!;
    expect(final).toEqual({ ...row, status: operation === 'approve' ? 'Approved' : 'ChangesRequested', version: expect.any(String) }); expect(final.version).not.toBe(row.version);
    expect(results[1]!.row).toEqual(final); expect(workers[1]!.events.some(event => event.type === 'written')).toBe(false);
    recordRace(`تصمیم نخست ${operation}`, workers, final);
  }, 30000);
});
