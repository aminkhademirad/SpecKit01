import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import type { Identity } from '../../domain/user';
import type { ChangeRequest } from '../../domain/change-request';
import { DomainError } from '../../domain/errors';
import { JwtIdentity } from '../../infrastructure/authentication/jwt-identity';

export interface AuthenticatedRequest extends IncomingMessage {
  params: Record<string, string | undefined>;
  identity?: Identity;
  visibleRequest?: ChangeRequest;
  body?: unknown;
}

export class AuthenticationGuard implements CanActivate {
  constructor(private readonly identities: JwtIdentity) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const match = typeof header === 'string' ? /^Bearer ([^\s,]+)$/i.exec(header) : null;
    if (!match?.[1]) throw new DomainError('UNAUTHENTICATED');
    request.identity = this.identities.verify(match[1]);
    return true;
  }
}
