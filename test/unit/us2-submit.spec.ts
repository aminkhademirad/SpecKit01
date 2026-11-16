import { randomUUID } from 'node:crypto';
import { SubmitChangeRequest } from '../../src/application/submit-change-request';
import { UpdateChangeRequest } from '../../src/application/update-change-request';
import { DomainError } from '../../src/domain/errors';
import { createDatabaseFixture, type DatabaseFixture } from '../fixtures/database-fixture';

describe('US2؛ Application مستقل از HTTP با fixture واقعی SQLite', () => {
  let fixture: DatabaseFixture;
  let submit: SubmitChangeRequest;
  beforeEach(() => {
    fixture = createDatabaseFixture();
    submit = new SubmitChangeRequest(fixture.unit, fixture.users, fixture.requests);
  });
  afterEach(() => { fixture.close(); });
  const snapshot = () => fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all();

  it.each(['requester-a', 'dual-c'])('AC-201؛ مالک %s از Draft ارسال می‌کند و فقط status/version تغییر می‌کنند', subject => {
    const row = subject === 'dual-c' ? fixture.records.dual.Draft : fixture.records.owned.Draft;
    let result: unknown = 'not-called';
    expect(() => { result = submit.execute(fixture.identity(subject), row.id, () => ({}), () => ({ id: row.id, version: row.version })); }).not.toThrow();
    expect(result).toBeUndefined();
    const after = fixture.requests.find(row.id)!;
    expect(after).toEqual({ ...row, status: 'PendingReview', version: expect.any(String) });
    expect(after.version).not.toBe(row.version);
  });

  it.each(['reviewer-b', 'dual-c'])('AC-202؛ غیرمالک %s حتی پیش از خواندن ورودی رد می‌شود', subject => {
    const before = snapshot(), row = fixture.records.owned.Draft, read = jest.fn(() => ({}));
    expect(() => submit.execute(fixture.identity(subject), row.id, read, () => ({ id: row.id, version: row.version }))).toThrow(expect.objectContaining({ code: 'REQUEST_UNAVAILABLE' }));
    expect(read).not.toHaveBeenCalled(); expect(snapshot()).toEqual(before);
  });

  it.each(['PendingReview', 'Approved'])('AC-203؛ ویرایش %s رد می‌شود و محتوا ثابت می‌ماند', status => {
    const row = fixture.records.owned[status as 'PendingReview' | 'Approved'], before = snapshot();
    const read = jest.fn(() => ({ title: 'تغییر', description: 'شرح', reason: 'دلیل' }));
    expect(() => new UpdateChangeRequest(fixture.unit, fixture.users, fixture.requests).execute(fixture.identity('requester-a'), row.id, read, () => ({ id: row.id, version: row.version }))).toThrow(expect.objectContaining({ code: 'INVALID_STATE' }));
    expect(read).not.toHaveBeenCalled(); expect(snapshot()).toEqual(before);
  });

  it('AC-204؛ لغو مجوز جاری با هویت قبلی مانع ارسال است', () => {
    const identity = fixture.identity('requester-a'), row = fixture.records.owned.Draft, before = snapshot();
    fixture.permissions.execute(identity.issuer, identity.subject, { isRequester: false, isReviewer: false });
    const read = jest.fn(() => ({}));
    expect(() => submit.execute(identity, row.id, read, () => ({ id: row.id, version: row.version }))).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(read).not.toHaveBeenCalled(); expect(snapshot()).toEqual(before);
  });

  it('AC-204؛ هویت منقضی تغییر ایجاد نمی‌کند', () => {
    const before = snapshot(), row = fixture.records.owned.Draft;
    expect(() => submit.execute({ ...fixture.identity('requester-a'), expiresAt: 0 }, row.id, () => ({}), () => ({ id: row.id, version: row.version }))).toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
    expect(snapshot()).toEqual(before);
  });

  it('AC-205؛ تکرار با نسخهٔ قدیمی وضعیت نامعتبر می‌دهد، نه موفقیت یا تعارض نسخه', () => {
    const row = fixture.records.owned.Draft, identity = fixture.identity('requester-a');
    submit.execute(identity, row.id, () => ({}), () => ({ id: row.id, version: row.version }));
    const committed = snapshot(), read = jest.fn(() => { throw new Error('نباید خوانده شود.'); });
    expect(() => submit.execute(identity, row.id, read, read)).toThrow(expect.objectContaining({ code: 'INVALID_STATE' }));
    expect(read).not.toHaveBeenCalled(); expect(snapshot()).toEqual(committed);
  });

  it.each(['PendingReview', 'Approved'] as const)('وضعیت %s پیش از ورودی و نسخه رد می‌شود', status => {
    const row = fixture.records.owned[status], before = snapshot(), read = jest.fn(() => { throw new Error('نباید خوانده شود.'); });
    expect(() => submit.execute(fixture.identity('requester-a'), row.id, read, read)).toThrow(expect.objectContaining({ code: 'INVALID_STATE' }));
    expect(read).not.toHaveBeenCalled(); expect(snapshot()).toEqual(before);
  });

  it.each([null, [], 'text', 1, { status: 'PendingReview' }, { requesterId: 'self' }])('بدنهٔ نامعتبر بدون تغییر رد می‌شود؛ %p', body => {
    const row = fixture.records.owned.Draft, before = snapshot();
    expect(() => submit.execute(fixture.identity('requester-a'), row.id, () => body, () => ({ id: row.id, version: row.version }))).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(snapshot()).toEqual(before);
  });

  it('نسخهٔ قدیمی روی Draft را بدون تغییر رد می‌کند', () => {
    const row = fixture.records.owned.Draft, before = snapshot();
    expect(() => submit.execute(fixture.identity('requester-a'), row.id, () => ({}), () => ({ id: row.id, version: randomUUID() }))).toThrow(expect.objectContaining({ code: 'CONCURRENCY_CONFLICT' }));
    expect(snapshot()).toEqual(before);
  });

  it('خطای پس از UPDATE با Rollback، status و version قبلی را حفظ می‌کند', () => {
    const row = fixture.records.owned.Draft, before = snapshot();
    const transition = fixture.requests.transition.bind(fixture.requests);
    jest.spyOn(fixture.requests, 'transition').mockImplementation((...args) => { transition(...args); throw new DomainError('INTERNAL_ERROR'); });
    expect(() => submit.execute(fixture.identity('requester-a'), row.id, () => ({}), () => ({ id: row.id, version: row.version }))).toThrow(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
    expect(snapshot()).toEqual(before);
  });

  it('انقضای هویت پیش از Commit انتقال را Rollback می‌کند', () => {
    const row = fixture.records.owned.Draft, identity = fixture.identity('requester-a'), before = snapshot();
    const clock = jest.spyOn(Date, 'now');
    try {
      expect(() => submit.execute(identity, row.id, () => ({}), () => {
        clock.mockReturnValue((identity.expiresAt + 1) * 1000);
        return { id: row.id, version: row.version };
      })).toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
    } finally { clock.mockRestore(); }
    expect(snapshot()).toEqual(before);
  });
});
