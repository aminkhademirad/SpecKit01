import type { INestApplication } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DomainError } from '../domain/errors';
import { ApiErrorFilter, respondError } from './filters/api-error.filter';

export const MAX_BODY_BYTES = 131072;

export function configureHttp(app: INestApplication): void {
  app.useGlobalFilters(new ApiErrorFilter());
  app.use((request: IncomingMessage & { body?: Buffer }, response: ServerResponse, next: () => void) => {
    response.setHeader('Cache-Control', 'no-store');
    const chunks: Buffer[] = [];
    let size = 0;
    let stopped = false;
    const rejectSize = (): void => {
      stopped = true;
      chunks.length = 0;
      respondError(response, new DomainError('PAYLOAD_TOO_LARGE'));
    };
    if (Number(request.headers['content-length']) > MAX_BODY_BYTES) {
      rejectSize(); request.resume(); return;
    }
    request.on('data', (chunk: Buffer) => {
      if (stopped) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) rejectSize();
      else chunks.push(chunk);
    });
    request.on('end', () => {
      if (!stopped) { request.body = Buffer.concat(chunks); next(); }
    });
    request.on('error', () => {
      if (!stopped && !response.writableEnded) {
        stopped = true;
        respondError(response, new DomainError('INVALID_INPUT', [{ field: 'body', reason: 'دریافت بدنه ناموفق بود.' }]));
      }
    });
  });
}
