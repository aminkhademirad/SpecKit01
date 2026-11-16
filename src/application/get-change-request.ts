import type { Identity } from '../domain/user';
import type { ChangeRequest } from '../domain/change-request';
import { RequestVisibility } from './request-visibility';

export class GetChangeRequest {
  constructor(private readonly visibility: RequestVisibility) {}
  execute(identity: Identity, id: string): ChangeRequest { return this.visibility.execute(identity, id); }
}
