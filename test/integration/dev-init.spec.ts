import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeDevelopmentEnvironment } from '../../tools/dev-init';
import { loadConfiguration } from '../../src/infrastructure/configuration';

describe('ایجاد امن تنظیمات توسعه', () => {
  let directory: string;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'changeflow-init-'));
    process.env.NODE_ENV = 'test';
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('کلید تصادفی ایجاد می‌کند و اجرای مجدد فایل یا کلید را تغییر نمی‌دهد', () => {
    expect(initializeDevelopmentEnvironment(directory)).toBe('created');
    const envFile = join(directory, '.env');
    const content = readFileSync(envFile, 'utf8');
    const configuration = loadConfiguration({}, envFile);
    expect(Buffer.from(configuration.jwtSecret, 'base64url')).toHaveLength(32);
    expect(initializeDevelopmentEnvironment(directory)).toBe('existing');
    expect(readFileSync(envFile, 'utf8')).toBe(content);
    const otherDirectory = mkdtempSync(join(tmpdir(), 'changeflow-init-other-'));
    try {
      initializeDevelopmentEnvironment(otherDirectory);
      expect(loadConfiguration({}, join(otherDirectory, '.env')).jwtSecret).not.toBe(configuration.jwtSecret);
    } finally {
      rmSync(otherDirectory, { recursive: true, force: true });
    }
  });

  it('فایل ناقص موجود را بازنویسی نمی‌کند', () => {
    const envFile = join(directory, '.env');
    writeFileSync(envFile, 'NODE_ENV=development\n');
    expect(() => initializeDevelopmentEnvironment(directory)).toThrow();
    expect(readFileSync(envFile, 'utf8')).toBe('NODE_ENV=development\n');
  });

  it('در production هیچ فایل محلی ایجاد نمی‌کند', () => {
    process.env.NODE_ENV = 'production';
    expect(() => initializeDevelopmentEnvironment(directory)).toThrow();
    expect(existsSync(join(directory, '.env'))).toBe(false);
  });
});
