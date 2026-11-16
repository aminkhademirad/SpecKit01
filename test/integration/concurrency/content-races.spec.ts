import { ControlledWorker, recordRace, type WorkerOptions } from '../../fixtures/concurrency-coordinator';
import { createDatabaseFixture, type DatabaseFixture } from '../../fixtures/database-fixture';

describe('US5؛ رقابت محتوا با اتصال مستقل', () => {
  let fixture: DatabaseFixture; let workers: ControlledWorker[];
  beforeEach(() => { fixture = createDatabaseFixture(); workers = []; });
  afterEach(async () => { await Promise.all(workers.map(worker => worker.close())); fixture.close(); });
  const spawn = (options: Omit<WorkerOptions, 'filename' | 'issuer' | 'subject'>) => {
    const worker = new ControlledWorker({ filename: fixture.filename, issuer: fixture.configuration.jwtIssuer, subject: 'requester-a', ...options }); workers.push(worker); return worker;
  };
  it.each(['Draft', 'ChangesRequested'] as const)('AC-501، AC-504 و AC-505؛ دو ویرایش %s فقط یک نسخه را می‌پذیرند', async status => {
    const row = fixture.records.owned[status], firstContent = { title: 'ویرایش اول', description: 'شرح اول', reason: 'دلیل اول' };
    const first = spawn({ operation: 'edit', id: row.id, version: row.version, content: firstContent, holdBeforeCommit: true });
    const second = spawn({ operation: 'edit', id: row.id, version: row.version, content: { ...firstContent, title: 'ویرایش دوم' } });
    const ready = await Promise.all(workers.map(worker => worker.phase('ready')));
    expect(ready.map(event => event.row)).toEqual([row, row]); expect(ready[0]!.threadId).not.toBe(ready[1]!.threadId);
    first.start(); await first.phase('written'); second.start(); await second.phase('attempt');
    first.release(2);
    const results = await Promise.all(workers.map(worker => worker.phase('result')));
    expect(results.map(event => event.code)).toEqual(['OK', 'CONCURRENCY_CONFLICT']);
    const final = fixture.requests.find(row.id)!;
    expect(final).toEqual({ ...row, ...firstContent, version: expect.any(String) }); expect(final.version).not.toBe(row.version);
    expect(results[1]!.row).toEqual(final);
    recordRace(`دو ویرایش ${status}`, workers, final);
  }, 30000);

  it.each(['submit', 'edit'] as const)('AC-503 و AC-505؛ رقابت ویرایش و Submit با برندهٔ %s', async winner => {
    const row = fixture.records.owned.Draft, content = { title: 'محتوای رقیب', description: 'شرح تازه', reason: 'دلیل تازه' };
    const first = spawn({ operation: winner, id: row.id, version: row.version, content, holdBeforeCommit: true });
    const second = spawn({ operation: winner === 'submit' ? 'edit' : 'submit', id: row.id, version: row.version, content });
    await Promise.all(workers.map(worker => worker.phase('ready')));
    first.start(); await first.phase('written'); second.start(); await second.phase('attempt'); first.release(2);
    const results = await Promise.all(workers.map(worker => worker.phase('result')));
    expect(results.map(event => event.code)).toEqual(['OK', winner === 'submit' ? 'INVALID_STATE' : 'CONCURRENCY_CONFLICT']);
    const final = fixture.requests.find(row.id)!;
    expect(final).toEqual({ ...row, ...(winner === 'edit' ? content : {}), status: winner === 'submit' ? 'PendingReview' : 'Draft', version: expect.any(String) });
    expect(final.version).not.toBe(row.version); expect(results[1]!.row).toEqual(final);
    recordRace(`ویرایش و Submit با برندهٔ ${winner}`, workers, final);
  }, 30000);
});
