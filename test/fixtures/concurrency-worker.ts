import { parentPort, workerData, threadId } from 'node:worker_threads';
import { SqliteDatabase } from '../../src/infrastructure/sqlite/sqlite-database';
import { SqliteUnitOfWork, databaseError } from '../../src/infrastructure/sqlite/sqlite-unit-of-work';
import { SqliteChangeRequestStore } from '../../src/infrastructure/sqlite/sqlite-change-request-store';
import { SqliteUserStore } from '../../src/infrastructure/sqlite/sqlite-user-store';
import { UpdateChangeRequest } from '../../src/application/update-change-request';
import { SubmitChangeRequest } from '../../src/application/submit-change-request';
import { ApproveChangeRequest } from '../../src/application/approve-change-request';
import { RequestChanges } from '../../src/application/request-changes';
import { ChangeUserPermissions } from '../../src/application/change-user-permissions';
import { DomainError } from '../../src/domain/errors';
import type { WorkerOptions, WorkerEvent } from './concurrency-coordinator';

const options = workerData as WorkerOptions & { gates: SharedArrayBuffer };
const gates = new Int32Array(options.gates);
const send = (type: WorkerEvent['type'], extra: Partial<WorkerEvent> = {}) => parentPort!.postMessage({ type, threadId, operation: options.operation, ...extra });
const wait = (index: number) => {
  if (Atomics.wait(gates, index, 0, 15000) === 'timed-out') throw new DomainError('INTERNAL_ERROR');
};
const database = new SqliteDatabase(options.filename);
const unit = new SqliteUnitOfWork(database), users = new SqliteUserStore(database), requests = new SqliteChangeRequestStore(database);
const original = unit.write.bind(unit);
unit.write = work => original(() => {
  send('locked'); if (options.holdAfterLock) wait(1);
  const value = work(); send('written');
  if (options.holdBeforeCommit) wait(2);
  if (options.failBeforeCommit) throw new DomainError('INTERNAL_ERROR');
  return value;
});
const identity = { issuer: options.issuer, subject: options.subject, expiresAt: Math.floor(Date.now() / 1000) + 300 };
let started = Date.now();
try {
  send('ready', { row: requests.find(options.id), busyTimeout: database.connection.pragma('busy_timeout', { simple: true }) as number });
  wait(0); started = Date.now(); send('attempt');
  const version = () => ({ id: options.id, version: options.version });
  switch (options.operation) {
    case 'edit': new UpdateChangeRequest(unit, users, requests).execute(identity, options.id, () => options.content, version); break;
    case 'submit': new SubmitChangeRequest(unit, users, requests).execute(identity, options.id, () => ({}), version); break;
    case 'approve': new ApproveChangeRequest(unit, users, requests).execute(identity, options.id, () => ({}), version); break;
    case 'request-changes': new RequestChanges(unit, users, requests).execute(identity, options.id, () => ({}), version); break;
    case 'revoke': new ChangeUserPermissions(unit, users).execute(options.issuer, options.subject, { isRequester: false, isReviewer: false }); break;
    case 'lock': unit.write(() => undefined); break;
  }
  send('committed'); send('result', { code: 'OK', row: requests.find(options.id), isReviewer: users.find(options.issuer, options.subject)?.isReviewer ?? null, elapsedMs: Date.now() - started });
} catch (error) {
  send('result', { code: databaseError(error).code, row: requests.find(options.id), isReviewer: users.find(options.issuer, options.subject)?.isReviewer ?? null, elapsedMs: Date.now() - started });
} finally { database.close(); }
