import type { ChangeRequest, RequestStatus } from '../../domain/change-request';
import { DomainError } from '../../domain/errors';
import { randomUUID } from 'node:crypto';
import { SqliteDatabase } from './sqlite-database';

export class SqliteChangeRequestStore {
  constructor(private readonly database: SqliteDatabase) {}
  insert(request: ChangeRequest): ChangeRequest {
    const rows = this.database.connection.prepare('INSERT INTO change_requests (id, title, description, reason, requesterId, status, version) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, title, description, reason, requesterId, status, version').all(request.id, request.title, request.description, request.reason, request.requesterId, request.status, request.version) as ChangeRequest[];
    if (rows.length !== 1) throw new DomainError('INTERNAL_ERROR');
    return Object.freeze(rows[0]!);
  }
  replaceContent(id: string, expectedVersion: string, content: Pick<ChangeRequest, 'title' | 'description' | 'reason'>): ChangeRequest {
    const rows = this.database.connection.prepare('UPDATE change_requests SET title = ?, description = ?, reason = ?, version = ? WHERE id = ? AND version = ? RETURNING id, title, description, reason, requesterId, status, version').all(content.title, content.description, content.reason, randomUUID(), id, expectedVersion) as ChangeRequest[];
    if (rows.length !== 1) throw new DomainError('CONCURRENCY_CONFLICT');
    return Object.freeze(rows[0]!);
  }
  transition(id: string, expectedVersion: string, status: RequestStatus): ChangeRequest {
    const rows = this.database.connection.prepare('UPDATE change_requests SET status = ?, version = ? WHERE id = ? AND version = ? RETURNING id, title, description, reason, requesterId, status, version').all(status, randomUUID(), id, expectedVersion) as ChangeRequest[];
    if (rows.length !== 1) throw new DomainError('CONCURRENCY_CONFLICT');
    return Object.freeze(rows[0]!);
  }
  find(id: string): ChangeRequest | null {
    const row = this.database.connection.prepare('SELECT id, title, description, reason, requesterId, status, version FROM change_requests WHERE id = ?').get(id) as ChangeRequest | undefined;
    return row ? Object.freeze(row) : null;
  }
}
