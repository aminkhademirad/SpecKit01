import { ControlledWorker, recordRace } from '../../fixtures/concurrency-coordinator';
import { createDatabaseFixture, type DatabaseFixture } from '../../fixtures/database-fixture';

describe('US5؛ ترتیب نهایی‌شدن لغو مجوز و تصمیم', () => {
  let fixture: DatabaseFixture; let workers: ControlledWorker[];
  beforeEach(() => { fixture = createDatabaseFixture(); workers = []; });
  afterEach(async () => { await Promise.all(workers.map(worker => worker.close())); fixture.close(); });
  for (const operation of ['approve', 'request-changes'] as const) {
    it.each(['revoke', 'decision'])(`AC-306، AC-506 و AC-507؛ ${operation} با برندهٔ %s`, async winner => {
      const row = fixture.records.owned.PendingReview;
      const common = { filename: fixture.filename, issuer: fixture.configuration.jwtIssuer, subject: 'reviewer-b', id: row.id, version: row.version };
      const first = new ControlledWorker({ ...common, operation: winner === 'revoke' ? 'revoke' : operation, holdBeforeCommit: true });
      const second = new ControlledWorker({ ...common, operation: winner === 'revoke' ? operation : 'revoke' }); workers.push(first, second);
      await Promise.all(workers.map(worker => worker.phase('ready')));
      first.start(); await first.phase('written'); second.start(); await second.phase('attempt'); first.release(2);
      const results = await Promise.all(workers.map(worker => worker.phase('result')));
      expect(results.map(event => event.code)).toEqual(['OK', winner === 'revoke' ? 'REQUEST_UNAVAILABLE' : 'OK']);
      const final = fixture.requests.find(row.id)!;
      if (winner === 'revoke') expect(final).toEqual(row);
      else { expect(final).toEqual({ ...row, status: operation === 'approve' ? 'Approved' : 'ChangesRequested', version: expect.any(String) }); expect(final.version).not.toBe(row.version); }
      expect(fixture.users.find(common.issuer, common.subject)!.isReviewer).toBe(false);
      recordRace(`${operation}؛ نخست ${winner}`, workers, { request: final, isReviewer: false });
    }, 30000);
  }
});
