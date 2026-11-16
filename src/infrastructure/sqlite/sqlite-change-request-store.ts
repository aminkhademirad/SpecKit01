import type { ChangeRequest } from '../../domain/change-request';
import { SqliteDatabase } from './sqlite-database';

export class SqliteChangeRequestStore {
  constructor(private readonly database: SqliteDatabase) {}
  find(id: string): ChangeRequest | null {
    const row = this.database.connection.prepare('SELECT id, title, description, reason, requesterId, status, version FROM change_requests WHERE id = ?').get(id) as ChangeRequest | undefined;
    return row ? Object.freeze(row) : null;
  }
}
