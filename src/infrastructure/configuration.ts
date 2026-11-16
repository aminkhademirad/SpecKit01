import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

export interface Configuration {
  readonly nodeEnv: 'development' | 'test';
  readonly port: number;
  readonly databasePath: string;
  readonly jwtIssuer: string;
  readonly jwtAudience: string;
  readonly jwtSecret: string;
}

export class ConfigurationError extends Error {}

export function loadConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
  envFile: string = resolve('.env'),
): Configuration {
  let local: NodeJS.ProcessEnv = {};
  try {
    if (existsSync(envFile)) local = parseEnv(readFileSync(envFile, 'utf8'));
  } catch {
    throw new ConfigurationError('خواندن فایل تنظیمات محلی ناموفق بود.');
  }
  const values = { ...local, ...environment };
  const required = (name: string): string => {
    const value = values[name];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new ConfigurationError(`متغیر پیکربندی ${name} الزامی است.`);
    }
    return value;
  };
  const nodeEnv = required('NODE_ENV');
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    throw new ConfigurationError('این پیکربندی محلی فقط برای development و test مجاز است.');
  }
  const portText = required('PORT');
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError('متغیر PORT باید عدد صحیح بین ۱ و ۶۵۵۳۵ باشد.');
  }
  const databasePath = required('DATABASE_PATH');
  if (/^(?:\\\\|\/\/|[a-z]+:\/\/)/i.test(databasePath) || databasePath === ':memory:') {
    throw new ConfigurationError('متغیر DATABASE_PATH باید مسیر فایل محلی باشد.');
  }
  const jwtIssuer = required('JWT_ISSUER');
  const jwtAudience = required('JWT_AUDIENCE');
  if (jwtIssuer !== 'changeflow-dev' || jwtAudience !== 'changeflow-api') {
    throw new ConfigurationError('issuer و audience با قرارداد محیط محلی سازگار نیستند.');
  }
  const jwtSecret = required('JWT_SECRET');
  if (Buffer.byteLength(jwtSecret, 'utf8') < 32) {
    throw new ConfigurationError('کلید محلی JWT_SECRET باید حداقل ۳۲ بایت باشد.');
  }
  return { nodeEnv, port, databasePath: resolve(databasePath), jwtIssuer, jwtAudience, jwtSecret };
}
