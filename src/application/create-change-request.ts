import { randomUUID } from 'node:crypto';
import { assertCanCreate, assertIdentity } from '../domain/authorization-policy';
import { validateChangeRequestContent } from '../domain/change-request-content';
import type { ChangeRequest } from '../domain/change-request';
import type { Identity } from '../domain/user';
import { SqliteUnitOfWork } from '../infrastructure/sqlite/sqlite-unit-of-work';
import { SqliteUserStore } from '../infrastructure/sqlite/sqlite-user-store';
import { SqliteChangeRequestStore } from '../infrastructure/sqlite/sqlite-change-request-store';

export class CreateChangeRequest {
  constructor(private readonly unit: SqliteUnitOfWork, private readonly users: SqliteUserStore, private readonly requests: SqliteChangeRequestStore) {}
  execute(identity: Identity, readContent: () => unknown): ChangeRequest {
    return this.unit.write(() => {
      assertIdentity(identity);
      const user = this.users.find(identity.issuer, identity.subject);
      assertCanCreate(identity, user);
      const content = validateChangeRequestContent(readContent());
      const created = this.requests.insert({ ...content, id: randomUUID(), version: randomUUID(), requesterId: user!.id, status: 'Draft' });
      assertIdentity(identity);
      return created;
    });
  }
}
