import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type Database from 'better-sqlite3';

export class MigrationError extends Error {}
interface Migration { version: number; checksum: string; sql: string }
interface Applied { version: number; checksum: string }

function discover(directory: string): Migration[] {
  const migrations = readdirSync(directory).filter(name => name.endsWith('.sql')).sort().map(name => {
    const match = /^(\d{3})-[a-z0-9-]+\.sql$/.exec(name);
    if (!match) throw new MigrationError('نام فایل Migration معتبر نیست.');
    const sql = readFileSync(join(directory, name), 'utf8').replace(/\r\n/g, '\n');
    return { version: Number(match[1]), sql, checksum: createHash('sha256').update(sql).digest('hex') };
  });
  if (!migrations.length || migrations.some((m, i) => m.version !== i + 1)) {
    throw new MigrationError('شماره‌های Migration باید یکتا، پیوسته و از یک آغاز شوند.');
  }
  return migrations;
}

function verifyApplied(applied: Applied[], migrations: Migration[]): void {
  if (applied.some((row, i) => row.version !== i + 1 || migrations[i]?.checksum !== row.checksum)) {
    throw new MigrationError('شماره یا checksum مربوط به Migration با فایل‌های مصوب سازگار نیست.');
  }
}

export function runMigrations(database: Database.Database, directory = resolve('migrations')): number {
  const migrations = discover(directory);
  return database.transaction(() => {
    database.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL CHECK (version > 0), checksum TEXT NOT NULL CHECK (length(checksum) = 64)) STRICT');
    const applied = database.prepare('SELECT version, checksum FROM schema_migrations ORDER BY version').all() as Applied[];
    verifyApplied(applied, migrations);
    const record = database.prepare('INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)');
    for (const migration of migrations.slice(applied.length)) {
      database.exec(migration.sql);
      record.run(migration.version, migration.checksum);
    }
    return migrations.length - applied.length;
  }).immediate();
}

export function assertMigrationsCurrent(database: Database.Database, directory = resolve('migrations')): void {
  const migrations = discover(directory);
  if (!database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get()) {
    throw new MigrationError('پیش از اجرا باید دستور db:migrate اجرا شود.');
  }
  const applied = database.prepare('SELECT version, checksum FROM schema_migrations ORDER BY version').all() as Applied[];
  verifyApplied(applied, migrations);
  if (applied.length !== migrations.length) throw new MigrationError('Migration اجرا‌نشده وجود دارد.');
}
