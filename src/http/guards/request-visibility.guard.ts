import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { DomainError } from '../../domain/errors';
import { RequestVisibility } from '../../application/request-visibility';
import type { AuthenticatedRequest } from './authentication.guard';

export class RequestVisibilityGuard implements CanActivate {
  constructor(private readonly visibility: RequestVisibility) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.identity) throw new DomainError('UNAUTHENTICATED');
    if (request.params.id !== undefined) request.visibleRequest = this.visibility.execute(request.identity, request.params.id);
    return true;
  }
}
