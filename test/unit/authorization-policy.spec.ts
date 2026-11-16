import { randomUUID } from 'node:crypto';
import { createUser, type Identity } from '../../src/domain/user';
import { REQUEST_STATUSES, CONTENT_LIMITS, type ChangeRequest } from '../../src/domain/change-request';
import { assertCanCreate, assertCanOperate, canView, type Operation } from '../../src/domain/authorization-policy';
import { DomainError } from '../../src/domain/errors';
import { encodeEtag, decodeIfMatch, assertExpectedVersion } from '../../src/http/etag';
import { ParseJsonBodyPipe } from '../../src/http/pipes/parse-json-body.pipe';

const owner = createUser(randomUUID(), 'changeflow-dev', 'owner', { isRequester: true, isReviewer: true });
const reviewer = createUser(randomUUID(), 'changeflow-dev', 'reviewer', { isReviewer: true });
const requester = createUser(randomUUID(), 'changeflow-dev', 'other', { isRequester: true });
const identity = (subject: string): Identity => ({ issuer: 'changeflow-dev', subject, expiresAt: Date.now() / 1000 + 60 });
const request = (status: ChangeRequest['status']): ChangeRequest => ({ id: randomUUID(), title: 'عنوان', description: 'شرح', reason: 'دلیل', requesterId: owner.id, status, version: randomUUID() });
const error = (code: string) => expect.objectContaining({ code });

describe('سیاست مستقل مجوز؛ FR-008، FR-009، FR-019 و FR-023', () => {
  it.each(REQUEST_STATUSES)('مالک وضعیت %s را حتی بدون نقش جاری می‌بیند', status => {
    const noRoles = createUser(owner.id, owner.issuer, owner.subject);
    expect(canView(identity('owner'), noRoles, request(status))).toBe(true);
  });
  it.each(REQUEST_STATUSES)('دامنهٔ مشاهدهٔ Reviewer در %s محدود است', status => {
    expect(canView(identity('reviewer'), reviewer, request(status))).toBe(status === 'PendingReview');
    expect(canView(identity('other'), requester, request(status))).toBe(false);
  });
  it.each(['Approve', 'RequestChanges'] as const)('هر دو نقش عملیات %s روی درخواست خود را مجاز نمی‌کند', operation => {
    expect(() => assertCanOperate(identity('owner'), owner, request('PendingReview'), operation)).toThrow(error('FORBIDDEN'));
    expect(() => assertCanOperate(identity('reviewer'), reviewer, request('PendingReview'), operation)).not.toThrow();
  });
  it.each(['Edit', 'Submit'] as const)('مالک دارای نقش Requester برای %s لازم است', operation => {
    const row = request('Draft');
    expect(() => assertCanOperate(identity('owner'), owner, row, operation)).not.toThrow();
    expect(() => assertCanOperate(identity('owner'), createUser(owner.id, owner.issuer, owner.subject), row, operation)).toThrow(error('FORBIDDEN'));
    expect(() => assertCanOperate(identity('reviewer'), reviewer, request('PendingReview'), operation)).toThrow(error('FORBIDDEN'));
  });
  it('نبود نگاشت، انقضا و عدم انطباق هویت را رد می‌کند', () => {
    expect(() => assertCanCreate(identity('unknown'), null)).toThrow(error('FORBIDDEN'));
    expect(canView(identity('unknown'), null, request('Draft'))).toBe(false);
    expect(canView(identity('other'), owner, request('Draft'))).toBe(false);
    expect(() => assertCanCreate({ ...identity('owner'), expiresAt: 0 }, owner)).toThrow(error('UNAUTHENTICATED'));
    expect(() => assertCanOperate(identity('reviewer'), reviewer, request('PendingReview'), 'Delete' as Operation)).toThrow(error('FORBIDDEN'));
  });
  it('مدل‌ها نقش غیرفعال پیش‌فرض، هویت UUID و حدود مصوب دارند', () => {
    expect(createUser(randomUUID(), 'issuer', 'subject')).toMatchObject({ isRequester: false, isReviewer: false });
    expect(() => createUser('invalid', 'issuer', 'subject')).toThrow();
    expect(CONTENT_LIMITS).toEqual({ title: 200, description: 5000, reason: 2000 });
  });
});

describe('ETag و ورودی deferred', () => {
  it('نسخهٔ معتبر را باز می‌خواند و نسخهٔ قدیمی را متمایز رد می‌کند', () => {
    const row = request('Draft');
    expect(decodeIfMatch(encodeEtag(row))).toEqual({ id: row.id, version: row.version });
    expect(() => assertExpectedVersion(encodeEtag(row), row)).not.toThrow();
    expect(() => assertExpectedVersion(encodeEtag(row), { ...row, version: randomUUID() })).toThrow(error('CONCURRENCY_CONFLICT'));
  });
  it.each(['*', 'W/"value"', '"a","b"', '', ['value']])('قالب نامعتبر %s را رد می‌کند', header => {
    expect(() => decodeIfMatch(header)).toThrow(error('INVALID_INPUT'));
  });
  it('نبود نسخه 428 را از قالب نامعتبر جدا می‌کند', () => {
    expect(() => decodeIfMatch(undefined)).toThrow(error('VERSION_REQUIRED'));
  });
  it('خطای JSON را تا unwrap نگه می‌دارد و خصوصیت را بی‌صدا حذف نمی‌کند', () => {
    const pipe = new ParseJsonBodyPipe();
    const deferred = pipe.transform(Buffer.from('{'));
    expect(() => deferred.unwrap()).toThrow(DomainError);
    const value = pipe.transform(Buffer.from('{"title":12,"status":"Draft"}'));
    expect(value.unwrap()).toEqual({ title: 12, status: 'Draft' });
    expect(() => value.unwrap(['title'])).toThrow(error('INVALID_INPUT'));
    expect(() => pipe.transform(Buffer.from([255])).unwrap()).toThrow(error('INVALID_INPUT'));
  });
});
