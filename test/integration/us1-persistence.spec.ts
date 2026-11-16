import { randomUUID } from 'node:crypto';
import { createDatabaseFixture, type DatabaseFixture } from '../fixtures/database-fixture';
import { SqliteDatabase } from '../../src/infrastructure/sqlite/sqlite-database';
import { SqliteChangeRequestStore } from '../../src/infrastructure/sqlite/sqlite-change-request-store';
import { CreateChangeRequest } from '../../src/application/create-change-request';
import { GetChangeRequest } from '../../src/application/get-change-request';
import { UpdateChangeRequest } from '../../src/application/update-change-request';

describe('US1؛ Persistence واقعی', () => {
  let fixture: DatabaseFixture;
  beforeEach(() => { fixture = createDatabaseFixture(); });
  afterEach(() => { fixture.close(); });

  it('AC-101؛ نگاشت تمام فیلدها پس از بازکردن اتصال دیگر باقی می‌ماند', () => {
    const row = { ...fixture.records.owned.Draft, id: randomUUID(), title: 'عنوان تازه', version: randomUUID() };
    expect(() => fixture.unit.write(() => fixture.requests.insert(row))).not.toThrow();
    const other = new SqliteDatabase(fixture.filename);
    try { expect(new SqliteChangeRequestStore(other).find(row.id)).toEqual(row); }
    finally { other.close(); }
  });

  it('AC-102 و AC-501؛ ویرایش مشروط نسخهٔ تازه دارد و نسخهٔ قدیمی داده را بازنویسی نمی‌کند', () => {
    const before = fixture.records.owned.Draft;
    const content = { title: 'عنوان تازه', description: 'شرح تازه', reason: 'دلیل تازه' };
    const after = fixture.unit.write(() => fixture.requests.replaceContent(before.id, before.version, content));
    expect(after).toEqual({ ...before, ...content, version: expect.any(String) });
    expect(after.version).not.toBe(before.version);
    expect(() => fixture.unit.write(() => fixture.requests.replaceContent(before.id, before.version, { ...content, title: 'قدیمی' }))).toThrow(expect.objectContaining({ code: 'CONCURRENCY_CONFLICT' }));
    expect(fixture.requests.find(before.id)).toEqual(after);
  });

  it('عملیات زیرساختی انتقال مشروط فقط status و version را تغییر می‌دهد', () => {
    const before = fixture.records.owned.Draft;
    const after = fixture.unit.write(() => fixture.requests.transition(before.id, before.version, 'PendingReview'));
    expect(after).toEqual({ ...before, status: 'PendingReview', version: expect.any(String) });
    expect(after.version).not.toBe(before.version);
    expect(() => fixture.unit.write(() => fixture.requests.transition(before.id, before.version, 'Approved'))).toThrow(expect.objectContaining({ code: 'CONCURRENCY_CONFLICT' }));
    expect(fixture.requests.find(before.id)).toEqual(after);
  });

  it('شناسه و مالک در SQLite تغییرناپذیرند و خطا تغییر جزئی باقی نمی‌گذارد', () => {
    const before = fixture.records.owned.Draft;
    expect(() => fixture.unit.write(() => {
      fixture.requests.replaceContent(before.id, before.version, { title: 'تغییر', description: 'شرح', reason: 'دلیل' });
      fixture.database.connection.prepare('UPDATE change_requests SET requesterId = ? WHERE id = ?').run(fixture.provisioned.dual.id, before.id);
    })).toThrow();
    expect(fixture.requests.find(before.id)).toEqual(before);
    expect(() => fixture.database.connection.prepare('UPDATE change_requests SET id = ? WHERE id = ?').run(randomUUID(), before.id)).toThrow();
  });

  it('Application بدون Controller مالکیت، وضعیت و ورودی را بررسی می‌کند', () => {
    const create = new CreateChangeRequest(fixture.unit, fixture.users, fixture.requests);
    const update = new UpdateChangeRequest(fixture.unit, fixture.users, fixture.requests);
    const get = new GetChangeRequest(fixture.visibility);
    const content = { title: 'عنوان', description: 'شرح', reason: 'دلیل' };
    const identity = fixture.identity('requester-a');
    const created = create.execute(identity, () => content);
    expect(get.execute(identity, created.id)).toEqual(created);
    const changed = update.execute(identity, created.id, () => ({ ...content, title: 'تازه' }), () => ({ id: created.id, version: created.version }));
    expect(fixture.requests.find(created.id)).toEqual(changed);
    expect(() => create.execute(identity, () => ({ ...content, status: 'Draft' }))).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    const before = fixture.requests.find(fixture.records.owned.Approved.id);
    const read = jest.fn(() => content);
    expect(() => update.execute(identity, fixture.records.owned.Approved.id, read, () => ({ id: 'invalid', version: 'invalid' }))).toThrow(expect.objectContaining({ code: 'INVALID_STATE' }));
    expect(read).not.toHaveBeenCalled();
    expect(fixture.requests.find(fixture.records.owned.Approved.id)).toEqual(before);
  });

  it('لغو مجوز با هویت قبلی، پیش از خواندن ورودی و بدون ایجاد یا ویرایش اثر می‌کند', () => {
    const identity = fixture.identity('requester-a');
    fixture.permissions.execute(identity.issuer, identity.subject, { isRequester: false, isReviewer: false });
    const before = fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all();
    const read = jest.fn(() => ({ title: 'عنوان', description: 'شرح', reason: 'دلیل' }));
    const row = fixture.records.owned.Draft;
    expect(() => new CreateChangeRequest(fixture.unit, fixture.users, fixture.requests).execute(identity, read)).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(() => new UpdateChangeRequest(fixture.unit, fixture.users, fixture.requests).execute(identity, row.id, read, () => ({ id: row.id, version: row.version }))).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(read).not.toHaveBeenCalled();
    expect(fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all()).toEqual(before);
  });

  it('AC-107؛ ایجاد تکراری مستقیم در Application دو ردیف مستقل با id و version تازه می‌سازد', () => {
    const application = new CreateChangeRequest(fixture.unit, fixture.users, fixture.requests);
    const identity = fixture.identity('requester-a');
    const content = { title: 'عنوان یکسان', description: 'شرح یکسان', reason: 'دلیل یکسان' };
    const first = application.execute(identity, () => content);
    const second = application.execute(identity, () => content);
    expect(second.id).not.toBe(first.id); expect(second.version).not.toBe(first.version);
    expect(fixture.requests.find(first.id)).toEqual(first);
    expect(fixture.requests.find(second.id)).toEqual(second);
    expect(fixture.database.connection.prepare('SELECT count(*) AS count FROM change_requests').get()).toEqual({ count: 10 });
  });

  it('هویت منقضی‌شده پیش از Commit باعث Rollback ایجاد می‌شود', () => {
    const identity = fixture.identity('requester-a');
    const before = fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all();
    const create = new CreateChangeRequest(fixture.unit, fixture.users, fixture.requests);
    const clock = jest.spyOn(Date, 'now');
    try {
      expect(() => create.execute(identity, () => {
        clock.mockReturnValue((identity.expiresAt + 1) * 1000);
        return { title: 'عنوان', description: 'شرح', reason: 'دلیل' };
      })).toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
    } finally { clock.mockRestore(); }
    expect(fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all()).toEqual(before);
  });
});
