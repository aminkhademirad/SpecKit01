import { randomUUID } from 'node:crypto';
import { createUser, type User } from '../../domain/user';
import { SqliteDatabase } from './sqlite-database';

interface UserRow { id: string; issuer: string; subject: string; isRequester: number; isReviewer: number }

export class SqliteUserStore {
  constructor(private readonly database: SqliteDatabase) {}

  find(issuer: string, subject: string): User | null {
    const row = this.database.connection.prepare('SELECT id, issuer, subject, isRequester, isReviewer FROM users WHERE issuer = ? AND subject = ?').get(issuer, subject) as UserRow | undefined;
    return row ? createUser(row.id, row.issuer, row.subject, { isRequester: row.isRequester === 1, isReviewer: row.isReviewer === 1 }) : null;
  }

  provision(issuer: string, subject: string, roles: { isRequester: boolean; isReviewer: boolean }): User {
    const user = createUser(randomUUID(), issuer, subject, roles);
    this.database.connection.prepare('INSERT INTO users (id, issuer, subject, isRequester, isReviewer) VALUES (?, ?, ?, ?, ?) ON CONFLICT (issuer, subject) DO NOTHING').run(user.id, issuer, subject, Number(user.isRequester), Number(user.isReviewer));
    return this.find(issuer, subject)!;
  }

  setPermissions(issuer: string, subject: string, roles: { isRequester: boolean; isReviewer: boolean }): boolean {
    if (typeof roles.isRequester !== 'boolean' || typeof roles.isReviewer !== 'boolean') throw new TypeError('مجوز باید مقدار منطقی داشته باشد.');
    return this.database.connection.prepare('UPDATE users SET isRequester = ?, isReviewer = ? WHERE issuer = ? AND subject = ?').run(Number(roles.isRequester), Number(roles.isReviewer), issuer, subject).changes === 1;
  }
}
