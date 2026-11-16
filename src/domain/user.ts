export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface User {
  readonly id: string;
  readonly issuer: string;
  readonly subject: string;
  readonly isRequester: boolean;
  readonly isReviewer: boolean;
}

export interface Identity {
  readonly issuer: string;
  readonly subject: string;
  readonly expiresAt: number;
}

export function isCurrentIdentity(identity: Identity, now = Date.now() / 1000): boolean {
  return typeof identity.issuer === 'string' && !!identity.issuer.trim() &&
    typeof identity.subject === 'string' && !!identity.subject.trim() &&
    Number.isFinite(identity.expiresAt) && identity.expiresAt > now;
}

export function createUser(
  id: string, issuer: string, subject: string,
  roles: { isRequester?: boolean; isReviewer?: boolean } = {},
): User {
  if (!UUID_PATTERN.test(id) || !issuer.trim() || !subject.trim() ||
    (roles.isRequester !== undefined && typeof roles.isRequester !== 'boolean') ||
    (roles.isReviewer !== undefined && typeof roles.isReviewer !== 'boolean')) {
    throw new TypeError('اطلاعات کاربر محلی معتبر نیست.');
  }
  return Object.freeze({ id, issuer, subject, isRequester: roles.isRequester ?? false, isReviewer: roles.isReviewer ?? false });
}
