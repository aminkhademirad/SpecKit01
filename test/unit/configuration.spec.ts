import { resolve } from 'node:path';
import { ConfigurationError, loadConfiguration } from '../../src/infrastructure/configuration';

const valid: NodeJS.ProcessEnv = {
  NODE_ENV: 'test', PORT: '3000', DATABASE_PATH: '.local/test.sqlite',
  JWT_ISSUER: 'changeflow-dev', JWT_AUDIENCE: 'changeflow-api', JWT_SECRET: 'x'.repeat(32),
};
const absentFile = resolve('test/fixtures/absent.env');

describe('پیکربندی محلی', () => {
  it('تنظیمات معتبر را بدون اتصال به Database می‌خواند', () => {
    const configuration = loadConfiguration(valid, absentFile);
    expect(configuration.port).toBe(3000);
    expect(configuration.databasePath).toBe(resolve('.local/test.sqlite'));
  });

  it.each(Object.keys(valid))('نبود متغیر %s را صریح رد می‌کند', (name) => {
    const environment = { ...valid };
    delete environment[name];
    expect(() => loadConfiguration(environment, absentFile)).toThrow(ConfigurationError);
  });

  it.each(['0', '65536', 'abc', '3.5'])('پورت نامعتبر %s را رد می‌کند', (port) => {
    expect(() => loadConfiguration({ ...valid, PORT: port }, absentFile)).toThrow(ConfigurationError);
  });

  it('پیکربندی نمایشی را در production فعال نمی‌کند', () => {
    expect(() => loadConfiguration({ ...valid, NODE_ENV: 'production' }, absentFile)).toThrow(ConfigurationError);
  });

  it.each(['JWT_ISSUER', 'JWT_AUDIENCE'])('مقدار ناسازگار %s را رد می‌کند', (name) => {
    expect(() => loadConfiguration({ ...valid, [name]: 'other' }, absentFile)).toThrow(ConfigurationError);
  });

  it('کلید کوتاه را بدون افشای مقدار آن رد می‌کند', () => {
    try {
      loadConfiguration({ ...valid, JWT_SECRET: 'sensitive-value' }, absentFile);
      throw new Error('خطای پیکربندی دریافت نشد.');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as Error).message).not.toContain('sensitive-value');
    }
  });

  it.each(['\\\\server\\share\\data.sqlite', '//server/share/data.sqlite', ':memory:'])('مسیر غیرمحلی %s را رد می‌کند', (databasePath) => {
    expect(() => loadConfiguration({ ...valid, DATABASE_PATH: databasePath }, absentFile)).toThrow(ConfigurationError);
  });
});
