import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigurationError, loadConfiguration } from '../src/infrastructure/configuration';

export function initializeDevelopmentEnvironment(directory: string = process.cwd()): 'created' | 'existing' {
  if (process.env.NODE_ENV && !['development', 'test'].includes(process.env.NODE_ENV)) {
    throw new ConfigurationError('ابزار dev:init فقط برای محیط توسعه و آزمون مجاز است.');
  }
  const envFile = resolve(directory, '.env');
  if (existsSync(envFile)) {
    loadConfiguration({}, envFile);
    return 'existing';
  }
  const content = [
    'NODE_ENV=development',
    'PORT=3000',
    'DATABASE_PATH=.local/changeflow.sqlite',
    'JWT_ISSUER=changeflow-dev',
    'JWT_AUDIENCE=changeflow-api',
    `JWT_SECRET=${randomBytes(32).toString('base64url')}`,
    '',
  ].join('\n');
  writeFileSync(envFile, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return 'created';
}

if (require.main === module) {
  try {
    const result = initializeDevelopmentEnvironment();
    console.info(result === 'created' ? 'تنظیمات محلی ایجاد شد؛ کلید نمایش داده نمی‌شود.' : 'تنظیمات موجود حفظ شد؛ کلید بازنویسی نشد.');
  } catch (error: unknown) {
    console.error(error instanceof ConfigurationError ? error.message : 'ایجاد تنظیمات محلی ناموفق بود؛ فایل موجود بازنویسی نشد.');
    process.exitCode = 1;
  }
}
