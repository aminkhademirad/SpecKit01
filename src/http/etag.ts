import { DomainError, invalidInput } from '../domain/errors';
import type { ChangeRequest } from '../domain/change-request';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeEtag(request: Pick<ChangeRequest, 'id' | 'version'>): string {
  if (!UUID_PATTERN.test(request.id) || !UUID_PATTERN.test(request.version)) throw new DomainError('INTERNAL_ERROR');
  return `"cf-${request.id}-${request.version}"`;
}

export function decodeIfMatch(header: unknown): { id: string; version: string } {
  if (header === undefined) throw new DomainError('VERSION_REQUIRED');
  const match = typeof header === 'string' ? /^"cf-([0-9a-f-]{36})-([0-9a-f-]{36})"$/i.exec(header) : null;
  if (!match?.[1] || !match[2] || !UUID_PATTERN.test(match[1]) || !UUID_PATTERN.test(match[2])) {
    throw invalidInput('If-Match', 'یک ETag قوی و معتبر لازم است.');
  }
  return { id: match[1], version: match[2] };
}

export function assertExpectedVersion(header: unknown, request: Pick<ChangeRequest, 'id' | 'version'>): void {
  const expected = decodeIfMatch(header);
  if (expected.id !== request.id || expected.version !== request.version) throw new DomainError('CONCURRENCY_CONFLICT');
}
