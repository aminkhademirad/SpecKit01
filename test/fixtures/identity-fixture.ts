import { randomBytes } from 'node:crypto';
import type { Configuration } from '../../src/infrastructure/configuration';
import { JwtIdentity } from '../../src/infrastructure/authentication/jwt-identity';

export function createIdentityFixture(databasePath: string) {
  const configuration: Configuration = {
    nodeEnv: 'test', port: 3000, databasePath, jwtIssuer: 'changeflow-dev',
    jwtAudience: 'changeflow-api', jwtSecret: randomBytes(32).toString('base64url'),
  };
  const jwt = new JwtIdentity(configuration);
  return { configuration, jwt, token: (subject: string) => jwt.issue(subject), identity: (subject: string) => jwt.verify(jwt.issue(subject)) };
}
