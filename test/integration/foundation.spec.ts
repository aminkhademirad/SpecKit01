import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { JwtService } from '@nestjs/jwt';
import { createDatabaseFixture, type DatabaseFixture } from '../fixtures/database-fixture';
import { SqliteDatabase } from '../../src/infrastructure/sqlite/sqlite-database';
import { SqliteUnitOfWork } from '../../src/infrastructure/sqlite/sqlite-unit-of-work';
import { runMigrations, assertMigrationsCurrent } from '../../src/infrastructure/sqlite/migration-runner';
import { DomainError } from '../../src/domain/errors';
import { assertCanOperate } from '../../src/domain/authorization-policy';

describe('زیرساخت واقعی؛ Migration، JWT، مجوز جاری و تراکنش', () => {
  let fixture: DatabaseFixture;
  beforeEach(() => { fixture = createDatabaseFixture(); });
  afterEach(() => { fixture.close(); });

  it('Migration تکراری داده را حذف نمی‌کند و اتصال FK و timeout صحیح دارد', () => {
    const db = fixture.database.connection;
    expect(runMigrations(db)).toBe(0);
    expect(() => assertMigrationsCurrent(db)).not.toThrow();
    expect(db.prepare('SELECT count(*) AS count FROM change_requests').get()).toEqual({ count: 8 });
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('busy_timeout', { simple: true })).toBe(1000);
    expect(db.pragma('journal_mode', { simple: true })).not.toBe('wal');
  });

  it('FK، نقش، هویت یکتا، وضعیت و ثبات مالک را در SQLite اعمال می‌کند', () => {
    const db = fixture.database.connection, row = fixture.records.owned.Draft;
    expect(() => db.prepare('UPDATE users SET isReviewer = 2 WHERE id = ?').run(fixture.provisioned.reviewer.id)).toThrow();
    expect(() => db.prepare('INSERT INTO users (id, issuer, subject) VALUES (?, ?, ?)').run(randomUUID(), fixture.configuration.jwtIssuer, 'reviewer-b')).toThrow();
    expect(() => db.prepare('UPDATE change_requests SET status = ? WHERE id = ?').run('Unknown', row.id)).toThrow();
    expect(() => db.prepare('UPDATE change_requests SET requesterId = ? WHERE id = ?').run(fixture.provisioned.dual.id, row.id)).toThrow();
    expect(() => db.prepare('DELETE FROM users WHERE id = ?').run(row.requesterId)).toThrow();
    expect(() => db.prepare('INSERT INTO change_requests (id,title,description,reason,requesterId,status,version) VALUES (?,?,?,?,?,?,?)').run(randomUUID(), 'a', 'b', 'c', randomUUID(), 'Draft', randomUUID())).toThrow();
    expect(fixture.requests.find(row.id)).toEqual(row);
  });

  it('تغییر checksum یا نسخهٔ ناشناخته را بدون بازنشانی رد می‌کند', () => {
    const db = fixture.database.connection;
    db.prepare('UPDATE schema_migrations SET checksum = ?').run('0'.repeat(64));
    expect(() => runMigrations(db)).toThrow();
    expect(() => assertMigrationsCurrent(db)).toThrow();
    expect(db.prepare('SELECT count(*) AS count FROM users').get()).toEqual({ count: 4 });
  });

  it('نسخهٔ ناشناخته و فایل Migration با شمارهٔ ناپیوسته را رد می‌کند', () => {
    const db = fixture.database.connection;
    db.prepare('INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)').run(2, '0'.repeat(64));
    expect(() => assertMigrationsCurrent(db)).toThrow();
    const directory = join(fixture.directory, 'gap'); mkdirSync(directory);
    writeFileSync(join(directory, '002-gap.sql'), 'CREATE TABLE unexpected (id INTEGER);');
    expect(() => runMigrations(db, directory)).toThrow();
  });

  it('Migration ناموفق و ثبت metadata آن با هم rollback می‌شوند', () => {
    const directory = join(fixture.directory, 'broken'); mkdirSync(directory);
    writeFileSync(join(directory, '001-broken.sql'), 'CREATE TABLE partial (id INTEGER); INVALID SQL;');
    const database = new SqliteDatabase(join(fixture.directory, 'broken.sqlite'));
    try {
      expect(() => runMigrations(database.connection, directory)).toThrow();
      expect(database.connection.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).toEqual([]);
    } finally { database.close(); }
  });

  it('آغاز سرویس روی Database بدون Migration را رد می‌کند', () => {
    const database = new SqliteDatabase(join(fixture.directory, 'empty.sqlite'));
    try { expect(() => assertMigrationsCurrent(database.connection)).toThrow(); }
    finally { database.close(); }
  });

  it('پایان خط CRLF محتوای Migration را متفاوت تلقی نمی‌کند', () => {
    const directory = join(fixture.directory, 'crlf'); mkdirSync(directory);
    const sql = readFileSync(resolve('migrations/001-initial-schema.sql'), 'utf8').replace(/\r?\n/g, '\r\n');
    writeFileSync(join(directory, '001-initial-schema.sql'), sql);
    expect(runMigrations(fixture.database.connection, directory)).toBe(0);
  });

  it('مجوز جاری را پس از صدور JWT دوباره از Database می‌خواند و seed آن را احیا نمی‌کند', () => {
    const identity = fixture.identity('reviewer-b'), row = fixture.records.owned.PendingReview;
    expect(fixture.visibility.execute(identity, row.id)).toEqual(row);
    fixture.permissions.execute(identity.issuer, identity.subject, { isRequester: false, isReviewer: false });
    expect(() => fixture.visibility.execute(identity, row.id)).toThrow(expect.objectContaining({ code: 'REQUEST_UNAVAILABLE' }));
    fixture.unit.write(() => fixture.users.provision(identity.issuer, identity.subject, { isRequester: false, isReviewer: true }));
    expect(fixture.users.find(identity.issuer, identity.subject)?.isReviewer).toBe(false);
  });

  it('هر دو تصمیم روی درخواست خود در فراخوانی مستقیم منطق مجوز رد می‌شوند', () => {
    const identity = fixture.identity('dual-c');
    for (const operation of ['Approve', 'RequestChanges'] as const) {
      expect(() => fixture.unit.write(() => assertCanOperate(identity, fixture.users.find(identity.issuer, identity.subject), fixture.records.dual.PendingReview, operation))).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
    }
  });

  it('برای JWT معتبر ناشناخته نگاشت یا نقش خودکار ایجاد نمی‌کند', () => {
    const identity = fixture.identity('unknown');
    expect(fixture.users.find(identity.issuer, identity.subject)).toBeNull();
    expect(() => fixture.visibility.execute(identity, fixture.records.owned.PendingReview.id)).toThrow(expect.objectContaining({ code: 'REQUEST_UNAVAILABLE' }));
    expect(fixture.database.connection.prepare('SELECT count(*) AS count FROM users').get()).toEqual({ count: 4 });
  });

  it('role claim برای JWT معتبر ناشناخته مجوز ایجاد نمی‌کند و فقط هویت برگردانده می‌شود', () => {
    const token = new JwtService().sign({ roles: ['Requester', 'Reviewer'], isReviewer: true }, {
      secret: fixture.configuration.jwtSecret, algorithm: 'HS256', subject: 'unknown',
      issuer: fixture.configuration.jwtIssuer, audience: fixture.configuration.jwtAudience, expiresIn: '5m',
    });
    const identity = fixture.jwt.verify(token);
    expect(Object.keys(identity).sort()).toEqual(['expiresAt', 'issuer', 'subject']);
    expect(() => fixture.visibility.execute(identity, fixture.records.owned.PendingReview.id)).toThrow(expect.objectContaining({ code: 'REQUEST_UNAVAILABLE' }));
    expect(fixture.users.find(identity.issuer, identity.subject)).toBeNull();
  });

  it('Rollback تغییر نقش را برمی‌گرداند و callback ناهمگام را اجرا نمی‌کند', () => {
    const before = fixture.users.find(fixture.configuration.jwtIssuer, 'reviewer-b');
    expect(() => fixture.unit.write(() => {
      fixture.users.setPermissions(fixture.configuration.jwtIssuer, 'reviewer-b', { isRequester: false, isReviewer: false });
      throw new DomainError('FORBIDDEN');
    })).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(fixture.users.find(fixture.configuration.jwtIssuer, 'reviewer-b')).toEqual(before);
    let invoked = false;
    const asynchronous = async () => { invoked = true; };
    expect(() => fixture.unit.write(asynchronous as unknown as () => void)).toThrow();
    expect(invoked).toBe(false);
  });

  it('BEGIN IMMEDIATE پیش از callback قفل نویسنده می‌گیرد و BUSY را از تعارض نسخه جدا می‌کند', () => {
    const other = new SqliteDatabase(fixture.filename);
    try {
      fixture.unit.write(() => {
        expect(fixture.database.connection.inTransaction).toBe(true);
        expect(() => other.connection.exec('BEGIN IMMEDIATE')).toThrow(expect.objectContaining({ code: 'SQLITE_BUSY' }));
      });
      other.connection.exec('BEGIN IMMEDIATE');
      let callbackRan = false;
      expect(() => fixture.unit.write(() => { callbackRan = true; })).toThrow(expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' }));
      expect(callbackRan).toBe(false);
    } finally { if (other.connection.inTransaction) other.connection.exec('ROLLBACK'); other.close(); }
    expect(new SqliteUnitOfWork(fixture.database).read(() => fixture.users.find(fixture.configuration.jwtIssuer, 'requester-a'))).not.toBeNull();
  });

  it.each(['signature', 'issuer', 'audience', 'missing-issuer', 'missing-audience', 'expired', 'missing-exp', 'missing-sub', 'blank-sub', 'algorithm'])('JWT نامعتبر %s را واقعاً رد می‌کند', kind => {
    const jwt = new JwtService();
    const payload: Record<string, unknown> = { iss: fixture.configuration.jwtIssuer, aud: fixture.configuration.jwtAudience, sub: 'reviewer-b', exp: Math.floor(Date.now() / 1000) + 60 };
    if (kind === 'issuer') payload.iss = 'other';
    if (kind === 'audience') payload.aud = 'other';
    if (kind === 'missing-issuer') delete payload.iss;
    if (kind === 'missing-audience') delete payload.aud;
    if (kind === 'expired') payload.exp = 1;
    if (kind === 'missing-exp') delete payload.exp;
    if (kind === 'missing-sub') delete payload.sub;
    if (kind === 'blank-sub') payload.sub = ' ';
    const token = jwt.sign(payload, { secret: kind === 'signature' ? 'wrong-key' : fixture.configuration.jwtSecret, algorithm: kind === 'algorithm' ? 'HS384' : 'HS256' });
    expect(() => fixture.jwt.verify(token)).toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
  });
});
