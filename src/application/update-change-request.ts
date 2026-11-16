import { assertCanOperate, assertIdentity } from '../domain/authorization-policy';
import { validateChangeRequestContent } from '../domain/change-request-content';
import { DomainError } from '../domain/errors';
import type { ChangeRequest } from '../domain/change-request';
import { UUID_PATTERN, type Identity } from '../domain/user';
import { SqliteUnitOfWork } from '../infrastructure/sqlite/sqlite-unit-of-work';
import { SqliteUserStore } from '../infrastructure/sqlite/sqlite-user-store';
import { SqliteChangeRequestStore } from '../infrastructure/sqlite/sqlite-change-request-store';

export class UpdateChangeRequest {
  constructor(private readonly unit: SqliteUnitOfWork, private readonly users: SqliteUserStore, private readonly requests: SqliteChangeRequestStore) {}
  execute(identity: Identity, id: string, readContent: () => unknown, readVersion: () => { id: string; version: string }): ChangeRequest {
    return this.unit.write(() => {
      assertIdentity(identity);
      if (!UUID_PATTERN.test(id)) throw new DomainError('REQUEST_UNAVAILABLE');
      const user = this.users.find(identity.issuer, identity.subject);
      const current = this.requests.find(id);
      assertCanOperate(identity, user, current, 'Edit');
      if (current!.status !== 'Draft' && current!.status !== 'ChangesRequested') throw new DomainError('INVALID_STATE');
      const content = validateChangeRequestContent(readContent());
      const expected = readVersion();
      if (expected.id !== current!.id || expected.version !== current!.version) throw new DomainError('CONCURRENCY_CONFLICT');
      const updated = this.requests.replaceContent(current!.id, expected.version, content);
      assertIdentity(identity);
      return updated;
    });
  }
}
