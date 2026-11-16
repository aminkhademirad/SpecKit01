import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { Configuration } from './infrastructure/configuration';
import { SqliteDatabase } from './infrastructure/sqlite/sqlite-database';
import { assertMigrationsCurrent } from './infrastructure/sqlite/migration-runner';
import { SqliteUnitOfWork } from './infrastructure/sqlite/sqlite-unit-of-work';
import { SqliteUserStore } from './infrastructure/sqlite/sqlite-user-store';
import { SqliteChangeRequestStore } from './infrastructure/sqlite/sqlite-change-request-store';
import { JwtIdentity } from './infrastructure/authentication/jwt-identity';
import { ChangeUserPermissions } from './application/change-user-permissions';
import { RequestVisibility } from './application/request-visibility';
import { AuthenticationGuard } from './http/guards/authentication.guard';
import { RequestVisibilityGuard } from './http/guards/request-visibility.guard';
import { CreateChangeRequest } from './application/create-change-request';
import { GetChangeRequest } from './application/get-change-request';
import { UpdateChangeRequest } from './application/update-change-request';
import { ChangeRequestsController } from './http/controllers/change-requests.controller';

@Module({})
export class AppModule {
  static forRoot(configuration: Configuration): DynamicModule {
    return {
      module: AppModule,
      controllers: [ChangeRequestsController],
      providers: [
        { provide: SqliteDatabase, useFactory: () => {
          const database = new SqliteDatabase(configuration.databasePath);
          try { assertMigrationsCurrent(database.connection); return database; }
          catch (error) { database.close(); throw error; }
        } },
        { provide: SqliteUnitOfWork, useFactory: (db: SqliteDatabase) => new SqliteUnitOfWork(db), inject: [SqliteDatabase] },
        { provide: SqliteUserStore, useFactory: (db: SqliteDatabase) => new SqliteUserStore(db), inject: [SqliteDatabase] },
        { provide: SqliteChangeRequestStore, useFactory: (db: SqliteDatabase) => new SqliteChangeRequestStore(db), inject: [SqliteDatabase] },
        { provide: JwtIdentity, useFactory: () => new JwtIdentity(configuration) },
        { provide: ChangeUserPermissions, useFactory: (unit: SqliteUnitOfWork, users: SqliteUserStore) => new ChangeUserPermissions(unit, users), inject: [SqliteUnitOfWork, SqliteUserStore] },
        { provide: RequestVisibility, useFactory: (unit: SqliteUnitOfWork, users: SqliteUserStore, requests: SqliteChangeRequestStore) => new RequestVisibility(unit, users, requests), inject: [SqliteUnitOfWork, SqliteUserStore, SqliteChangeRequestStore] },
        { provide: CreateChangeRequest, useFactory: (unit: SqliteUnitOfWork, users: SqliteUserStore, requests: SqliteChangeRequestStore) => new CreateChangeRequest(unit, users, requests), inject: [SqliteUnitOfWork, SqliteUserStore, SqliteChangeRequestStore] },
        { provide: GetChangeRequest, useFactory: (visibility: RequestVisibility) => new GetChangeRequest(visibility), inject: [RequestVisibility] },
        { provide: UpdateChangeRequest, useFactory: (unit: SqliteUnitOfWork, users: SqliteUserStore, requests: SqliteChangeRequestStore) => new UpdateChangeRequest(unit, users, requests), inject: [SqliteUnitOfWork, SqliteUserStore, SqliteChangeRequestStore] },
        { provide: APP_GUARD, useFactory: (jwt: JwtIdentity) => new AuthenticationGuard(jwt), inject: [JwtIdentity] },
        { provide: APP_GUARD, useFactory: (visibility: RequestVisibility) => new RequestVisibilityGuard(visibility), inject: [RequestVisibility] },
      ],
      exports: [SqliteDatabase, SqliteUnitOfWork, SqliteUserStore, SqliteChangeRequestStore, JwtIdentity, ChangeUserPermissions, RequestVisibility, CreateChangeRequest, GetChangeRequest, UpdateChangeRequest],
    };
  }
}
