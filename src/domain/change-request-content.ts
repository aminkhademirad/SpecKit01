import { DomainError, invalidInput, type FieldError } from './errors';
import { CONTENT_LIMITS, CONTENT_MIN_SCALARS } from './change-request';

export interface ChangeRequestContent {
  readonly title: string;
  readonly description: string;
  readonly reason: string;
}

export function validateChangeRequestContent(input: unknown): ChangeRequestContent {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw invalidInput('body', 'بدنه باید شیء محتوایی باشد.');
  const values = input as Record<string, unknown>;
  const fields = Object.keys(CONTENT_LIMITS) as (keyof ChangeRequestContent)[];
  const errors: FieldError[] = Object.keys(values).filter(field => !fields.includes(field as keyof ChangeRequestContent)).map(field => ({ field, reason: 'این خصوصیت مجاز نیست.' }));
  const normalized: Partial<Record<keyof ChangeRequestContent, string>> = {};
  for (const field of fields) {
    const value = Object.hasOwn(values, field) ? values[field] : undefined;
    if (typeof value !== 'string') { errors.push({ field, reason: 'مقدار متنی این فیلد الزامی است.' }); continue; }
    if (!value.isWellFormed()) { errors.push({ field, reason: 'متن باید Unicode معتبر باشد.' }); continue; }
    const trimmed = value.trim();
    const length = [...trimmed].length;
    if (length < CONTENT_MIN_SCALARS || length > CONTENT_LIMITS[field]) {
      errors.push({ field, reason: `طول متن پس از حذف فاصلهٔ بیرونی باید بین ۱ و ${CONTENT_LIMITS[field]} Unicode scalar باشد.` });
    } else normalized[field] = trimmed;
  }
  if (errors.length) throw new DomainError('INVALID_INPUT', errors);
  return Object.freeze(normalized as unknown as ChangeRequestContent);
}
