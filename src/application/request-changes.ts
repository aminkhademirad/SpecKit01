import { UUID_PATTERN, type Identity } from '../domain/user';
import { DomainError, invalidInput } from '../domain/errors';
import { assertCanOperate, assertIdentity } from '../domain/authorization-policy';
import { SqliteUnitOfWork } from '../infrastructure/sqlite/sqlite-unit-of-work';
import { SqliteUserStore } from '../infrastructure/sqlite/sqlite-user-store';
import { SqliteChangeRequestStore } from '../infrastructure/sqlite/sqlite-change-request-store';

export class RequestChanges {
  constructor(private readonly unit: SqliteUnitOfWork, private readonly users: SqliteUserStore, private readonly requests: SqliteChangeRequestStore) {}
  execute(identity: Identity, id: string, readBody: () => unknown, readVersion: () => { id: string; version: string }): void {
    this.unit.write(() => {
      assertIdentity(identity);
      if (!UUID_PATTERN.test(id)) throw new DomainError('REQUEST_UNAVAILABLE');
      const user = this.users.find(identity.issuer, identity.subject);
      const current = this.requests.find(id);
      assertCanOperate(identity, user, current, 'RequestChanges');
      if (current!.status !== 'PendingReview') throw new DomainError('INVALID_STATE');
      const body = readBody();
      if (body !== undefined && (typeof body !== 'object' || body === null || Array.isArray(body))) throw invalidInput('body', 'بدنه باید غایب یا شیء JSON خالی باشد.');
      const fields = body === undefined ? [] : Object.keys(body);
      if (fields.length) throw new DomainError('INVALID_INPUT', fields.map(field => ({ field, reason: 'این خصوصیت در RequestChanges مجاز نیست.' })));
      const expected = readVersion();
      if (expected.id !== current!.id || expected.version !== current!.version) throw new DomainError('CONCURRENCY_CONFLICT');
      this.requests.transition(current!.id, expected.version, 'ChangesRequested');
      assertIdentity(identity);
    });
  }
}
