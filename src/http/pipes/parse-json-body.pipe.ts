import type { PipeTransform } from '@nestjs/common';
import { DomainError, invalidInput } from '../../domain/errors';

export class DeferredJsonBody {
  constructor(private readonly value: unknown, private readonly error?: DomainError) {}
  unwrap(allowedFields?: readonly string[]): unknown {
    if (this.error) throw this.error;
    if (allowedFields) {
      if (typeof this.value !== 'object' || this.value === null || Array.isArray(this.value)) {
        throw invalidInput('body', 'بدنه باید شیء JSON باشد.');
      }
      const extra = Object.keys(this.value).filter(key => !allowedFields.includes(key));
      if (extra.length) throw new DomainError('INVALID_INPUT', extra.map(field => ({ field, reason: 'این خصوصیت مجاز نیست.' })));
    }
    return this.value;
  }
}

export class ParseJsonBodyPipe implements PipeTransform<unknown, DeferredJsonBody> {
  transform(raw: unknown): DeferredJsonBody {
    try {
      if (raw === undefined || (Buffer.isBuffer(raw) && raw.length === 0)) return new DeferredJsonBody({});
      if (!Buffer.isBuffer(raw)) return new DeferredJsonBody(undefined, invalidInput('body', 'بدنهٔ خام معتبر نیست.'));
      const text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
      return new DeferredJsonBody(JSON.parse(text) as unknown);
    } catch { return new DeferredJsonBody(undefined, invalidInput('body', 'بدنه باید JSON و UTF-8 معتبر باشد.')); }
  }
}
