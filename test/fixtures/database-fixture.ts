import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REQUEST_STATUSES, type ChangeRequest, type RequestStatus } from '../../src/domain/change-request';
import { SqliteDatabase } from '../../src/infrastructure/sqlite/sqlite-database';
import { runMigrations } from '../../src/infrastructure/sqlite/migration-runner';
import { SqliteUnitOfWork } from '../../src/infrastructure/sqlite/sqlite-unit-of-work';
import { SqliteUserStore } from '../../src/infrastructure/sqlite/sqlite-user-store';
import { SqliteChangeRequestStore } from '../../src/infrastructure/sqlite/sqlite-change-request-store';
import { ChangeUserPermissions } from '../../src/application/change-user-permissions';
import { RequestVisibility } from '../../src/application/request-visibility';
import { createIdentityFixture } from './identity-fixture';

export function createDatabaseFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'changeflow-foundation-'));
  const filename = join(directory, 'test.sqlite');
  const database = new SqliteDatabase(filename);
  try {
    runMigrations(database.connection);
    const unit = new SqliteUnitOfWork(database);
    const users = new SqliteUserStore(database);
    const requests = new SqliteChangeRequestStore(database);
    const identity = createIdentityFixture(filename);
    const issuer = identity.configuration.jwtIssuer;
    const provisioned = unit.write(() => ({
      requester: users.provision(issuer, 'requester-a', { isRequester: true, isReviewer: false }),
      reviewer: users.provision(issuer, 'reviewer-b', { isRequester: false, isReviewer: true }),
      dual: users.provision(issuer, 'dual-c', { isRequester: true, isReviewer: true }),
      reviewer2: users.provision(issuer, 'reviewer-d', { isRequester: false, isReviewer: true }),
    }));
    const insertStates = (owner: string): Record<RequestStatus, ChangeRequest> => {
      const result = {} as Record<RequestStatus, ChangeRequest>;
      const insert = database.connection.prepare('INSERT INTO change_requests (id, title, description, reason, requesterId, status, version) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const status of REQUEST_STATUSES) {
        const row: ChangeRequest = { id: randomUUID(), title: 'درخواست نمونه', description: 'شرح نمونه', reason: 'دلیل نمونه', requesterId: owner, status, version: randomUUID() };
        insert.run(row.id, row.title, row.description, row.reason, row.requesterId, row.status, row.version);
        result[status] = row;
      }
      return result;
    };
    const records = unit.write(() => ({ owned: insertStates(provisioned.requester.id), dual: insertStates(provisioned.dual.id) }));
    return {
      directory, filename, database, unit, users, requests, ...identity, provisioned, records,
      permissions: new ChangeUserPermissions(unit, users), visibility: new RequestVisibility(unit, users, requests),
      close: () => { database.close(); rmSync(directory, { recursive: true, force: true }); },
    };
  } catch (error) { database.close(); rmSync(directory, { recursive: true, force: true }); throw error; }
}

export type DatabaseFixture = ReturnType<typeof createDatabaseFixture>;
