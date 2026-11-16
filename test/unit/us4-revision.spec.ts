import { randomUUID } from 'node:crypto';
import { UpdateChangeRequest } from '../../src/application/update-change-request';
import { SubmitChangeRequest } from '../../src/application/submit-change-request';
import { CONTENT_LIMITS } from '../../src/domain/change-request';
import { DomainError } from '../../src/domain/errors';
import { createDatabaseFixture, type DatabaseFixture } from '../fixtures/database-fixture';

const valid = { title: 'عنوان تازه', description: 'شرح تازه', reason: 'دلیل تازه' };

describe('US4؛ اصلاح و ارسال مجدد مستقل از HTTP با SQLite واقعی', () => {
  let fixture: DatabaseFixture;
  beforeEach(() => { fixture = createDatabaseFixture(); });
  afterEach(() => { fixture.close(); });
  const snapshot = () => fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all();
  const update = () => new UpdateChangeRequest(fixture.unit, fixture.users, fixture.requests);
  const submit = () => new SubmitChangeRequest(fixture.unit, fixture.users, fixture.requests);

  it.each(['requester-a', 'dual-c'])('AC-401 و AC-402؛ مالک %s همان درخواست را اصلاح و ارسال می‌کند', subject => {
    const row = subject === 'dual-c' ? fixture.records.dual.ChangesRequested : fixture.records.owned.ChangesRequested;
    const identity = fixture.identity(subject);
    const edited = update().execute(identity, row.id, () => valid, () => row);
    expect(edited).toEqual({ ...row, ...valid, version: expect.any(String) }); expect(edited.version).not.toBe(row.version);
    expect(fixture.requests.find(row.id)).toEqual(edited);
    submit().execute(identity, row.id, () => ({}), () => edited);
    const after = fixture.requests.find(row.id)!;
    expect(after).toEqual({ ...edited, status: 'PendingReview', version: expect.any(String) }); expect(after.version).not.toBe(edited.version);
    expect(snapshot()).toHaveLength(8);
  });

  it.each([undefined, {}])('AC-402؛ ارسال مجدد مستقل با بدنهٔ %p فقط وضعیت و نسخه را تغییر می‌دهد', body => {
    const row = fixture.records.owned.ChangesRequested;
    submit().execute(fixture.identity('requester-a'), row.id, () => body, () => row);
    const after = fixture.requests.find(row.id)!;
    expect(after).toEqual({ ...row, status: 'PendingReview', version: expect.any(String) }); expect(after.version).not.toBe(row.version);
  });

  for (const operation of ['Edit', 'Submit'] as const) {
    const execute = (subject: string, read: () => unknown, version?: string) => {
      const row = fixture.records.owned.ChangesRequested;
      return operation === 'Edit' ? update().execute(fixture.identity(subject), row.id, read, () => ({ id: row.id, version: version ?? row.version })) : submit().execute(fixture.identity(subject), row.id, read, () => ({ id: row.id, version: version ?? row.version }));
    };
    describe(operation, () => {
      it.each(['reviewer-b', 'dual-c'])('AC-403؛ غیرمالک %s پیش از خواندن ورودی رد می‌شود', subject => {
        const before = snapshot(), read = jest.fn(() => valid);
        expect(() => execute(subject, read)).toThrow(expect.objectContaining({ code: 'REQUEST_UNAVAILABLE' }));
        expect(read).not.toHaveBeenCalled(); expect(snapshot()).toEqual(before);
      });
      it('مجوز جاری لغوشدهٔ مالک پیش از ورودی رد می‌شود', () => {
        const before = snapshot(), identity = fixture.identity('requester-a'), read = jest.fn(() => valid);
        fixture.permissions.execute(identity.issuer, identity.subject, { isRequester: false, isReviewer: false });
        expect(() => execute('requester-a', read)).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
        expect(read).not.toHaveBeenCalled(); expect(snapshot()).toEqual(before);
      });
      it('نسخهٔ قدیمی تغییر ایجاد نمی‌کند', () => {
        const before = snapshot();
        expect(() => execute('requester-a', () => operation === 'Edit' ? valid : {}, randomUUID())).toThrow(expect.objectContaining({ code: 'CONCURRENCY_CONFLICT' }));
        expect(snapshot()).toEqual(before);
      });
      it('خطای پس از نوشتن باعث Rollback واقعی می‌شود', () => {
        const before = snapshot();
        if (operation === 'Edit') {
          const original = fixture.requests.replaceContent.bind(fixture.requests);
          jest.spyOn(fixture.requests, 'replaceContent').mockImplementation((...args) => { original(...args); throw new DomainError('INTERNAL_ERROR'); });
        } else {
          const original = fixture.requests.transition.bind(fixture.requests);
          jest.spyOn(fixture.requests, 'transition').mockImplementation((...args) => { original(...args); throw new DomainError('INTERNAL_ERROR'); });
        }
        expect(() => execute('requester-a', () => operation === 'Edit' ? valid : {})).toThrow(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
        expect(snapshot()).toEqual(before);
      });
      it('انقضای هویت پیش از Commit باعث Rollback می‌شود', () => {
        const before = snapshot(), row = fixture.records.owned.ChangesRequested, identity = fixture.identity('requester-a'), clock = jest.spyOn(Date, 'now');
        const version = () => { clock.mockReturnValue((identity.expiresAt + 1) * 1000); return row; };
        try {
          expect(() => operation === 'Edit' ? update().execute(identity, row.id, () => valid, version) : submit().execute(identity, row.id, () => ({}), version)).toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
        } finally { clock.mockRestore(); }
        expect(snapshot()).toEqual(before);
      });
    });
  }

  for (const [field, maximum] of Object.entries(CONTENT_LIMITS)) {
    it.each([1, maximum])(`AC-405 و AC-407؛ حد معتبر ${field} با %i scalar پس از trim حفظ می‌شود`, length => {
      const row = fixture.records.owned.ChangesRequested, value = '😀'.repeat(length);
      const result = update().execute(fixture.identity('requester-a'), row.id, () => ({ ...valid, [field]: ` \n${value}\t ` }), () => row);
      expect(result).toEqual({ ...row, ...valid, [field]: value, version: expect.any(String) });
      expect(fixture.requests.find(row.id)).toEqual(result);
    });
    it.each([null, '', ' \t\n\u00a0', 42, false, [], {}, '\ud800', '\udfff', 'ف'.repeat(maximum + 1)])(`AC-405؛ ${field} نامعتبر کل ویرایش را رد می‌کند`, value => {
      const row = fixture.records.owned.ChangesRequested, before = snapshot();
      expect(() => update().execute(fixture.identity('requester-a'), row.id, () => ({ ...valid, [field]: value }), () => row)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT', errors: expect.arrayContaining([expect.objectContaining({ field })]) }));
      expect(snapshot()).toEqual(before);
    });
    it(`AC-405؛ نبود ${field} تغییر جزئی ایجاد نمی‌کند`, () => {
      const row = fixture.records.owned.ChangesRequested, before = snapshot(), body: Record<string, unknown> = { ...valid }; delete body[field];
      expect(() => update().execute(fixture.identity('requester-a'), row.id, () => body, () => row)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
      expect(snapshot()).toEqual(before);
    });
  }

  for (const field of ['requesterId', 'status', 'id', 'version'] as const) {
    it.each(['same', 'different'])(`AC-406؛ فیلد ${field} با مقدار %s رد کامل می‌شود`, mode => {
      const row = fixture.records.owned.ChangesRequested, before = snapshot();
      expect(() => update().execute(fixture.identity('requester-a'), row.id, () => ({ ...valid, [field]: mode === 'same' ? row[field] : 'different' }), () => row)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT', errors: expect.arrayContaining([expect.objectContaining({ field })]) }));
      expect(snapshot()).toEqual(before);
    });
  }
  it.each([null, [], 42, 'text', { ...valid, extra: true }])('AC-405 و AC-406؛ بدنهٔ نامعتبر بدون تغییر رد می‌شود؛ %p', body => {
    const row = fixture.records.owned.ChangesRequested, before = snapshot();
    expect(() => update().execute(fixture.identity('requester-a'), row.id, () => body, () => row)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(snapshot()).toEqual(before);
  });
  it('AC-407؛ فارسی، لاتین، نیم‌فاصله، ترکیب Unicode و نشانه‌های قالب‌بندی متن ساده می‌مانند', () => {
    const row = fixture.records.owned.ChangesRequested, value = 'فارسی English نیم‌فاصله 👩‍💻 e\u0301 <b>متن</b> **متن**';
    const content = { title: value, description: value, reason: value };
    const edited = update().execute(fixture.identity('requester-a'), row.id, () => ({ title: ` ${value} `, description: `\n${value}\t`, reason: value }), () => row);
    expect(edited).toEqual({ ...row, ...content, version: expect.any(String) }); expect(fixture.requests.find(row.id)).toEqual(edited);
  });
});
