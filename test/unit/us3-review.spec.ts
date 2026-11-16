import { randomUUID } from 'node:crypto';
import { ApproveChangeRequest } from '../../src/application/approve-change-request';
import { RequestChanges } from '../../src/application/request-changes';
import { DomainError } from '../../src/domain/errors';
import { createDatabaseFixture, type DatabaseFixture } from '../fixtures/database-fixture';

describe('US3؛ تصمیم در Application با SQLite واقعی و بدون HTTP', () => {
  let fixture: DatabaseFixture;
  beforeEach(() => { fixture = createDatabaseFixture(); });
  afterEach(() => { fixture.close(); });
  const snapshot = () => fixture.database.connection.prepare('SELECT * FROM change_requests ORDER BY id').all();

  for (const operation of ['Approve', 'RequestChanges'] as const) {
    const destination = operation === 'Approve' ? 'Approved' : 'ChangesRequested';
    const service = () => operation === 'Approve' ? new ApproveChangeRequest(fixture.unit, fixture.users, fixture.requests) : new RequestChanges(fixture.unit, fixture.users, fixture.requests);

    describe(operation, () => {
      it('AC-301 و AC-302؛ تصمیم موفق فقط status و version را تغییر می‌دهد', () => {
        const row = fixture.records.owned.PendingReview;
        expect(() => service().execute(fixture.identity('reviewer-b'), row.id, () => ({}), () => ({ id: row.id, version: row.version }))).not.toThrow();
        const after = fixture.requests.find(row.id)!;
        expect(after).toEqual({ ...row, status: destination, version: expect.any(String) }); expect(after.version).not.toBe(row.version);
      });

      it('AC-303 و AC-311؛ دو نقش، تصمیم روی درخواست خود را مجاز نمی‌کنند', () => {
        const row = fixture.records.dual.PendingReview, before = snapshot(), read = jest.fn(() => ({}));
        expect(() => service().execute(fixture.identity('dual-c'), row.id, read, () => ({ id: row.id, version: row.version }))).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
        expect(read).not.toHaveBeenCalled(); expect(snapshot()).toEqual(before);
      });

      it('AC-304 و AC-306؛ لغو مجوز قبلاً Commit‌شده با هویت قدیمی هم اعمال می‌شود', () => {
        const identity = fixture.identity('reviewer-b'), row = fixture.records.owned.PendingReview, before = snapshot();
        fixture.permissions.execute(identity.issuer, identity.subject, { isRequester: false, isReviewer: false });
        const read = jest.fn(() => ({}));
        expect(() => service().execute(identity, row.id, read, () => ({ id: row.id, version: row.version }))).toThrow(expect.objectContaining({ code: 'REQUEST_UNAVAILABLE' }));
        expect(read).not.toHaveBeenCalled(); expect(snapshot()).toEqual(before);
      });

      it.each(['Draft', 'ChangesRequested', 'Approved'] as const)('AC-305 و AC-307؛ وضعیت %s خارج از visibility Reviewer است', status => {
        const row = fixture.records.owned[status], before = snapshot();
        expect(() => service().execute(fixture.identity('reviewer-b'), row.id, () => ({}), () => ({ id: row.id, version: row.version }))).toThrow(expect.objectContaining({ code: 'REQUEST_UNAVAILABLE' }));
        expect(snapshot()).toEqual(before);
      });

      it('AC-312؛ پس از تصمیم، تکرار با هویت همان Reviewer وضعیت را بازنویسی نمی‌کند', () => {
        const row = fixture.records.owned.PendingReview, identity = fixture.identity('reviewer-b');
        service().execute(identity, row.id, () => ({}), () => ({ id: row.id, version: row.version }));
        const committed = snapshot();
        expect(() => service().execute(identity, row.id, () => ({}), () => ({ id: row.id, version: row.version }))).toThrow(expect.objectContaining({ code: 'REQUEST_UNAVAILABLE' }));
        expect(snapshot()).toEqual(committed);
      });

      it('نسخهٔ قدیمی روی PendingReview بدون تغییر رد می‌شود', () => {
        const row = fixture.records.owned.PendingReview, before = snapshot();
        expect(() => service().execute(fixture.identity('reviewer-b'), row.id, () => ({}), () => ({ id: row.id, version: randomUUID() }))).toThrow(expect.objectContaining({ code: 'CONCURRENCY_CONFLICT' }));
        expect(snapshot()).toEqual(before);
      });

      it.each([null, [], 'text', { status: 'Approved' }, { reason: 'نظر بررسی' }, { requesterId: 'self' }])('بدنهٔ نامعتبر %p هیچ تغییر ندارد', body => {
        const row = fixture.records.owned.PendingReview, before = snapshot();
        expect(() => service().execute(fixture.identity('reviewer-b'), row.id, () => body, () => ({ id: row.id, version: row.version }))).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
        expect(snapshot()).toEqual(before);
      });

      it('خطای پس از UPDATE باعث Rollback واقعی تصمیم می‌شود', () => {
        const row = fixture.records.owned.PendingReview, before = snapshot(), transition = fixture.requests.transition.bind(fixture.requests);
        jest.spyOn(fixture.requests, 'transition').mockImplementation((...args) => { transition(...args); throw new DomainError('INTERNAL_ERROR'); });
        expect(() => service().execute(fixture.identity('reviewer-b'), row.id, () => ({}), () => ({ id: row.id, version: row.version }))).toThrow(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
        expect(snapshot()).toEqual(before);
      });

      it('هویت منقضی‌شده پیش از Commit باعث Rollback تصمیم می‌شود', () => {
        const row = fixture.records.owned.PendingReview, before = snapshot(), identity = fixture.identity('reviewer-b'), clock = jest.spyOn(Date, 'now');
        try {
          expect(() => service().execute(identity, row.id, () => ({}), () => {
            clock.mockReturnValue((identity.expiresAt + 1) * 1000); return { id: row.id, version: row.version };
          })).toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
        } finally { clock.mockRestore(); }
        expect(snapshot()).toEqual(before);
      });

      it('لغو مجوز بعد از Commit تصمیم، نتیجهٔ ثبت‌شده را باطل نمی‌کند', () => {
        const row = fixture.records.owned.PendingReview, identity = fixture.identity('reviewer-b');
        service().execute(identity, row.id, () => ({}), () => ({ id: row.id, version: row.version }));
        const committed = fixture.requests.find(row.id);
        fixture.permissions.execute(identity.issuer, identity.subject, { isRequester: false, isReviewer: false });
        expect(fixture.requests.find(row.id)).toEqual(committed);
      });

      it('هویت منقضی و نگاشت ناموجود بدون تغییر رد می‌شوند', () => {
        const row = fixture.records.owned.PendingReview, before = snapshot();
        expect(() => service().execute({ ...fixture.identity('reviewer-b'), expiresAt: 0 }, row.id, () => ({}), () => ({ id: row.id, version: row.version }))).toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
        expect(() => service().execute(fixture.identity('unknown'), row.id, () => ({}), () => ({ id: row.id, version: row.version }))).toThrow(expect.objectContaining({ code: 'REQUEST_UNAVAILABLE' }));
        expect(snapshot()).toEqual(before);
      });
    });
  }
});
