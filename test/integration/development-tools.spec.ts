import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { createDatabaseFixture, type DatabaseFixture } from '../fixtures/database-fixture';
import { SqliteDatabase } from '../../src/infrastructure/sqlite/sqlite-database';

jest.setTimeout(30000);

describe('ابزارهای واقعی توسعه بدون چاپ توکن در گزارش آزمون', () => {
  let fixture: DatabaseFixture;
  beforeEach(() => { fixture = createDatabaseFixture(); });
  afterEach(() => { fixture.close(); });

  const run = (file: string, args: string[] = [], overrides: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath, [require.resolve('tsx/cli'), resolve(`tools/${file}.ts`), ...args], {
    cwd: resolve('.'), encoding: 'utf8', timeout: 15000,
    env: { ...process.env, NODE_ENV: 'test', PORT: '3000', DATABASE_PATH: fixture.filename,
      JWT_ISSUER: fixture.configuration.jwtIssuer, JWT_AUDIENCE: fixture.configuration.jwtAudience,
      JWT_SECRET: fixture.configuration.jwtSecret, ...overrides },
  });

  it('Migration واقعی از CLI تکرارپذیر است و seed داده و مجوز لغوشده را بازنشانی نمی‌کند', () => {
    expect(run('migrate').status).toBe(0);
    expect(run('dev-seed').status).toBe(0);
    expect(run('dev-permissions', ['--subject', 'reviewer-b', '--requester', 'false', '--reviewer', 'false']).status).toBe(0);
    expect(run('dev-seed').status).toBe(0);
    expect(fixture.users.find(fixture.configuration.jwtIssuer, 'reviewer-b')?.isReviewer).toBe(false);
    expect(fixture.database.connection.prepare('SELECT count(*) AS count FROM change_requests').get()).toEqual({ count: 8 });
  }, 20000);

  it('توکن کوتاه‌عمر واقعی با sub معتبر می‌سازد و subject ناشناخته را provision نمی‌کند', () => {
    const result = run('dev-token', ['--subject', 'requester-a']);
    expect(result.status).toBe(0);
    expect(() => fixture.jwt.verify(result.stdout.trim())).not.toThrow();
    expect(fixture.jwt.verify(result.stdout.trim()).subject).toBe('requester-a');
    expect(run('dev-token', ['--subject', 'unknown']).status).toBe(1);
    expect(fixture.users.find(fixture.configuration.jwtIssuer, 'unknown')).toBeNull();
  });

  it('Migration را روی فایل تازه اعمال می‌کند و ابزارهای دیگر پیش از Migration رد می‌شوند', () => {
    const filename = join(fixture.directory, `${randomUUID()}.sqlite`);
    expect(run('dev-seed', [], { DATABASE_PATH: filename }).status).toBe(1);
    expect(run('migrate', [], { DATABASE_PATH: filename }).status).toBe(0);
    const database = new SqliteDatabase(filename);
    try { expect(database.connection.prepare('SELECT count(*) AS count FROM users').get()).toEqual({ count: 0 }); }
    finally { database.close(); }
  });

  it.each(['migrate', 'dev-seed', 'dev-token', 'dev-permissions'])('ابزار %s در production اجرا نمی‌شود', file => {
    expect(run(file, [], { NODE_ENV: 'production' }).status).toBe(1);
  });
});
