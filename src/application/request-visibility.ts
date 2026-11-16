import { assertCanView, assertIdentity } from '../domain/authorization-policy';
import { DomainError } from '../domain/errors';
import { UUID_PATTERN, type Identity } from '../domain/user';
import type { ChangeRequest } from '../domain/change-request';
import { SqliteUnitOfWork } from '../infrastructure/sqlite/sqlite-unit-of-work';
import { SqliteUserStore } from '../infrastructure/sqlite/sqlite-user-store';
import { SqliteChangeRequestStore } from '../infrastructure/sqlite/sqlite-change-request-store';

export class RequestVisibility {
  constructor(private readonly unitOfWork: SqliteUnitOfWork, private readonly users: SqliteUserStore, private readonly requests: SqliteChangeRequestStore) {}
  execute(identity: Identity, id: string): ChangeRequest {
    return this.unitOfWork.read(() => {
      assertIdentity(identity);
      if (!UUID_PATTERN.test(id)) throw new DomainError('REQUEST_UNAVAILABLE');
      const user = this.users.find(identity.issuer, identity.subject);
      const request = this.requests.find(id);
      assertCanView(identity, user, request);
      return request;
    });
  }
}
