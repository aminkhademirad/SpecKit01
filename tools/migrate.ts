import { loadConfiguration } from '../src/infrastructure/configuration';
import { SqliteDatabase } from '../src/infrastructure/sqlite/sqlite-database';
import { MigrationError, runMigrations } from '../src/infrastructure/sqlite/migration-runner';

let database: SqliteDatabase | undefined;
try {
  const configuration = loadConfiguration();
  database = new SqliteDatabase(configuration.databasePath);
  const count = runMigrations(database.connection);
  console.info(`Migration کامل شد؛ تعداد تغییرات جدید: ${count}`);
} catch (error: unknown) {
  console.error(error instanceof MigrationError ? error.message : 'اجرای Migration ناموفق بود؛ داده‌ها بازنشانی نشدند.');
  process.exitCode = 1;
} finally { database?.close(); }
