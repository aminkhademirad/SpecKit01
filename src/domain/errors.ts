export type ErrorCode = 'UNAUTHENTICATED' | 'REQUEST_UNAVAILABLE' | 'FORBIDDEN' |
  'INVALID_INPUT' | 'INVALID_STATE' | 'CONCURRENCY_CONFLICT' | 'VERSION_REQUIRED' |
  'PAYLOAD_TOO_LARGE' | 'SERVICE_UNAVAILABLE' | 'INTERNAL_ERROR';

export interface FieldError { readonly field: string; readonly reason: string }

export class DomainError extends Error {
  constructor(readonly code: ErrorCode, readonly errors: readonly FieldError[] = []) {
    super(code);
  }
}

export function invalidInput(field: string, reason: string): DomainError {
  return new DomainError('INVALID_INPUT', [{ field, reason }]);
}
