import { DomainError } from '../../domain/errors';
import { SqliteDatabase } from './sqlite-database';

export function databaseError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  return new DomainError(typeof code === 'string' && code.startsWith('SQLITE_BUSY') ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_ERROR');
}

export class SqliteUnitOfWork {
  constructor(private readonly database: SqliteDatabase) {}

  private execute<T>(work: () => T, write: boolean): T {
    try {
      if (this.database.connection.inTransaction || work.constructor.name === 'AsyncFunction') {
        throw new DomainError('INTERNAL_ERROR');
      }
      const transaction = this.database.connection.transaction(() => {
        const result = work();
        if (result !== null && (typeof result === 'object' || typeof result === 'function') && 'then' in result) {
          throw new DomainError('INTERNAL_ERROR');
        }
        return result;
      });
      return write ? transaction.immediate() : transaction.deferred();
    } catch (error) { throw databaseError(error); }
  }

  write<T>(work: () => T extends PromiseLike<unknown> ? never : T): T { return this.execute(work, true); }
  read<T>(work: () => T extends PromiseLike<unknown> ? never : T): T { return this.execute(work, false); }
}
