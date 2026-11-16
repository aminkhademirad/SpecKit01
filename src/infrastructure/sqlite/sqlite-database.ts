import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class SqliteDatabase {
  readonly connection: Database.Database;

  constructor(filename: string) {
    if (!filename.trim() || /^(?:\\\\|\/\/|[a-z]+:\/\/)/i.test(filename) || filename === ':memory:') {
      throw new Error('Database باید فایل محلی باشد.');
    }
    mkdirSync(dirname(filename), { recursive: true });
    this.connection = new Database(filename, { timeout: 1000 });
    try { this.connection.pragma('foreign_keys = ON'); }
    catch (error) { this.connection.close(); throw error; }
  }

  close(): void { if (this.connection.open) this.connection.close(); }
  onApplicationShutdown(): void { this.close(); }
}
