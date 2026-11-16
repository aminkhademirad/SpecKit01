import { parseArgs } from 'node:util';
import { loadConfiguration, ConfigurationError } from '../src/infrastructure/configuration';
import { SqliteDatabase } from '../src/infrastructure/sqlite/sqlite-database';
import { assertMigrationsCurrent, MigrationError } from '../src/infrastructure/sqlite/migration-runner';
import { SqliteUnitOfWork } from '../src/infrastructure/sqlite/sqlite-unit-of-work';
import { SqliteUserStore } from '../src/infrastructure/sqlite/sqlite-user-store';
import { ChangeUserPermissions } from '../src/application/change-user-permissions';
import { JwtIdentity } from '../src/infrastructure/authentication/jwt-identity';
import { invalidInput } from '../src/domain/errors';

export function cliArguments(names: string[]): Record<string, string> {
  const parsed = parseArgs({ options: Object.fromEntries(names.map(name => [name, { type: 'string' as const }])), strict: true, allowPositionals: false });
  const values: Record<string, string> = {};
  for (const name of names) {
    const value = parsed.values[name];
    if (typeof value !== 'string' || !value.trim()) throw invalidInput(name, 'مقدار این گزینه الزامی است.');
    values[name] = value;
  }
  return values;
}

export function withDevelopmentContext(action: (context: {
  issuer: string; unit: SqliteUnitOfWork; users: SqliteUserStore; permissions: ChangeUserPermissions; jwt: JwtIdentity;
}) => void): void {
  let database: SqliteDatabase | undefined;
  try {
    const configuration = loadConfiguration();
    database = new SqliteDatabase(configuration.databasePath);
    assertMigrationsCurrent(database.connection);
    const unit = new SqliteUnitOfWork(database);
    const users = new SqliteUserStore(database);
    action({ issuer: configuration.jwtIssuer, unit, users, permissions: new ChangeUserPermissions(unit, users), jwt: new JwtIdentity(configuration) });
  } catch (error) {
    console.error(error instanceof ConfigurationError || error instanceof MigrationError ? error.message : 'عملیات ابزار توسعه ناموفق بود؛ اطلاعات حساس نمایش داده نمی‌شوند.');
    process.exitCode = 1;
  } finally { database?.close(); }
}
