import { JwtService } from '@nestjs/jwt';
import { DomainError } from '../../domain/errors';
import { isCurrentIdentity, type Identity } from '../../domain/user';
import type { Configuration } from '../configuration';

export class JwtIdentity {
  private readonly jwt = new JwtService();
  constructor(private readonly configuration: Configuration) {}

  verify(token: string): Identity {
    try {
      const payload = this.jwt.verify<Record<string, unknown>>(token, {
        secret: this.configuration.jwtSecret, algorithms: ['HS256'],
        issuer: this.configuration.jwtIssuer, audience: this.configuration.jwtAudience,
      });
      if (typeof payload.sub !== 'string' || typeof payload.iss !== 'string' || typeof payload.exp !== 'number') {
        throw new DomainError('UNAUTHENTICATED');
      }
      const identity = Object.freeze({ issuer: payload.iss, subject: payload.sub, expiresAt: payload.exp });
      if (!isCurrentIdentity(identity)) throw new DomainError('UNAUTHENTICATED');
      return identity;
    } catch { throw new DomainError('UNAUTHENTICATED'); }
  }

  issue(subject: string): string {
    if (!subject.trim()) throw new DomainError('UNAUTHENTICATED');
    return this.jwt.sign({}, {
      secret: this.configuration.jwtSecret, algorithm: 'HS256', subject,
      issuer: this.configuration.jwtIssuer, audience: this.configuration.jwtAudience, expiresIn: '5m',
    });
  }
}
