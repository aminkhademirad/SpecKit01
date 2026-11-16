import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('بارگذاری واقعی Native Driver', () => {
  it('دادهٔ Unicode را در فایل SQLite موقت ثبت و پس از بازکردن مجدد بازیابی می‌کند', () => {
    const directory = mkdtempSync(join(tmpdir(), 'changeflow-native-'));
    const filename = join(directory, 'smoke.sqlite');
    let database: Database.Database | undefined;
    try {
      database = new Database(filename);
      database.exec('CREATE TABLE smoke (id INTEGER PRIMARY KEY, content TEXT NOT NULL)');
      const content = 'آماده‌سازی ChangeFlow 🔄';
      database.prepare('INSERT INTO smoke (id, content) VALUES (?, ?)').run(1, content);
      const version = database.prepare('SELECT sqlite_version() AS version').get() as { version: string };
      expect(version.version).toMatch(/^\d+\.\d+\.\d+$/);
      database.close();
      database = new Database(filename);
      expect(database.prepare('SELECT content FROM smoke WHERE id = ?').get(1)).toEqual({ content });
      console.info(`نسخهٔ SQLite بارگذاری‌شده: ${version.version}`);
    } finally {
      if (database?.open) database.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
