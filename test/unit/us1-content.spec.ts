import { validateChangeRequestContent } from '../../src/domain/change-request-content';
import { CONTENT_LIMITS } from '../../src/domain/change-request';

const valid = { title: 'عنوان', description: 'شرح تغییر', reason: 'دلیل تغییر' };

describe('US1؛ اعتبارسنجی مستقل محتوا', () => {
  it('AC-101 و AC-112؛ محتوای معتبر پس از trim پذیرفته می‌شود', () => {
    expect(() => validateChangeRequestContent(valid)).not.toThrow();
    expect(validateChangeRequestContent({ title: '  عنوان\n', description: '\tشرح تغییر ', reason: ' دلیل تغییر ' })).toEqual(valid);
  });

  for (const [field, maximum] of Object.entries(CONTENT_LIMITS)) {
    it.each([1, maximum])(`AC-109؛ ${field} با %i scalar پذیرفته می‌شود`, length => {
      const value = '😀'.repeat(length);
      expect(validateChangeRequestContent({ ...valid, [field]: value })).toHaveProperty(field, value);
    });
    it(`AC-111؛ ${field} بیش از سقف رد می‌شود`, () => {
      expect(() => validateChangeRequestContent({ ...valid, [field]: 'ف'.repeat(maximum + 1) })).toThrow(expect.objectContaining({ code: 'INVALID_INPUT', errors: expect.arrayContaining([expect.objectContaining({ field })]) }));
    });
    it(`AC-112؛ حداکثر ${field} همراه فاصلهٔ بیرونی معتبر است`, () => {
      const value = 'ف'.repeat(maximum);
      expect(validateChangeRequestContent({ ...valid, [field]: ` \n${value}\t ` })).toHaveProperty(field, value);
    });
    it.each([null, '', ' \t\n\u00a0', 42, false, [], {}])(`AC-110 و AC-115؛ ${field} نامعتبر رد می‌شود`, value => {
      expect(() => validateChangeRequestContent({ ...valid, [field]: value })).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    });
    it(`AC-110؛ نبود ${field} رد می‌شود`, () => {
      const input: Record<string, unknown> = { ...valid }; delete input[field];
      expect(() => validateChangeRequestContent(input)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    });
    it.each(['\ud800', '\udfff'])(`Unicode ناسالم در ${field} رد می‌شود`, value => {
      expect(() => validateChangeRequestContent({ ...valid, [field]: value })).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    });
  }

  it.each(['requesterId', 'status', 'id', 'version', 'extra'])('AC-105 و AC-113؛ خصوصیت %s حتی با مقدار درست رد می‌شود', field => {
    expect(() => validateChangeRequestContent({ ...valid, [field]: field === 'status' ? 'Draft' : 'value' })).toThrow(expect.objectContaining({ code: 'INVALID_INPUT', errors: expect.arrayContaining([expect.objectContaining({ field })]) }));
  });
  it('AC-114؛ زبان، نیم‌فاصله، ایموجی مرکب و نشانه‌های قالب‌بندی حفظ می‌شوند', () => {
    const value = 'متن English نیم‌فاصله 👩‍💻 <b>متن</b> **متن**';
    expect(validateChangeRequestContent({ title: value, description: value, reason: value })).toEqual({ title: value, description: value, reason: value });
    expect(() => validateChangeRequestContent({ ...valid, title: '👩‍💻'.repeat(67) })).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });
  it.each([null, [], 'text', 123])('بدنهٔ غیرشیء رد می‌شود', input => {
    expect(() => validateChangeRequestContent(input)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });
});
