import { isCurrentIdentity, type User, type Identity } from './user';
import type { ChangeRequest } from './change-request';
import { DomainError } from './errors';

export type Operation = 'Edit' | 'Submit' | 'Approve' | 'RequestChanges';

export function assertIdentity(identity: Identity, now = Date.now() / 1000): void {
  if (!isCurrentIdentity(identity, now)) {
    throw new DomainError('UNAUTHENTICATED');
  }
}

function isMapped(identity: Identity, user: User | null): user is User {
  return user !== null && identity.issuer === user.issuer && identity.subject === user.subject;
}

export function canView(identity: Identity, user: User | null, request: ChangeRequest | null): boolean {
  assertIdentity(identity);
  return isMapped(identity, user) && request !== null &&
    (request.requesterId === user.id || (user.isReviewer && request.status === 'PendingReview'));
}

export function assertCanView(identity: Identity, user: User | null, request: ChangeRequest | null): asserts request is ChangeRequest {
  if (!canView(identity, user, request)) throw new DomainError('REQUEST_UNAVAILABLE');
}

export function assertCanCreate(identity: Identity, user: User | null): void {
  assertIdentity(identity);
  if (!isMapped(identity, user) || !user.isRequester) throw new DomainError('FORBIDDEN');
}

export function assertCanOperate(identity: Identity, user: User | null, request: ChangeRequest | null, operation: Operation): void {
  assertCanView(identity, user, request);
  if (!user) throw new DomainError('REQUEST_UNAVAILABLE');
  const owner = user.id === request.requesterId;
  const allowed = operation === 'Edit' || operation === 'Submit' ? owner && user.isRequester :
    (operation === 'Approve' || operation === 'RequestChanges') && !owner && user.isReviewer;
  if (!allowed) throw new DomainError('FORBIDDEN');
}
