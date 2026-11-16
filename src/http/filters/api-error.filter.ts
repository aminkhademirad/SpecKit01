import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { DomainError, type ErrorCode } from '../../domain/errors';

export interface JsonResponse {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  removeHeader(name: string): unknown;
  end(body?: string): unknown;
}

const responses: Record<ErrorCode, readonly [number, string, string]> = {
  UNAUTHENTICATED: [401, 'هویت نامعتبر', 'احراز هویت معتبر لازم است.'],
  REQUEST_UNAVAILABLE: [404, 'درخواست در دسترس نیست', 'درخواست در دسترس نیست.'],
  FORBIDDEN: [403, 'مجوز ناکافی برای درخواست قابل مشاهده', 'اجازهٔ انجام این عملیات را ندارید.'],
  INVALID_INPUT: [400, 'ورودی نامعتبر', 'اطلاعات ورودی معتبر نیست.'],
  INVALID_STATE: [409, 'وضعیت نامعتبر', 'این عملیات در وضعیت فعلی مجاز نیست.'],
  CONCURRENCY_CONFLICT: [412, 'تعارض هم‌زمان', 'درخواست پس از مشاهدهٔ شما تغییر کرده است؛ دوباره آن را دریافت کنید.'],
  VERSION_REQUIRED: [428, 'ورودی نامعتبر', 'نسخهٔ مشاهده‌شده را در If-Match ارسال کنید.'],
  PAYLOAD_TOO_LARGE: [413, 'خطای فنی', 'حجم بدنهٔ درخواست بیش از حد مجاز است'],
  SERVICE_UNAVAILABLE: [503, 'خطای فنی', 'سرویس موقتاً در دسترس نیست.'],
  INTERNAL_ERROR: [500, 'خطای فنی', 'خطای داخلی رخ داد.'],
};

export function respondError(response: JsonResponse, error: DomainError): void {
  const [status, category, message] = responses[error.code];
  response.statusCode = status;
  response.removeHeader('ETag'); response.removeHeader('Location');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (status === 401) response.setHeader('WWW-Authenticate', 'Bearer');
  const publicMessage = error.code === 'FORBIDDEN' && error.reason === 'SELF_REVIEW' ? 'تأیید یا برگشت درخواست خودتان مجاز نیست.' : message;
  const body: Record<string, unknown> = { code: error.code, category, message: publicMessage };
  if (error.code === 'INVALID_INPUT') body.errors = error.errors;
  if (error.code === 'VERSION_REQUIRED') body.errors = [{ field: 'If-Match', reason: 'نسخهٔ مشاهده‌شده الزامی است.' }];
  response.end(JSON.stringify(body));
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const error = exception instanceof DomainError ? exception :
      exception instanceof HttpException && exception.getStatus() === 404 ? new DomainError('REQUEST_UNAVAILABLE') : new DomainError('INTERNAL_ERROR');
    respondError(host.switchToHttp().getResponse<JsonResponse>(), error);
  }
}
