import { invalidInput } from '../domain/errors';
import { SqliteUserStore } from '../infrastructure/sqlite/sqlite-user-store';
import { SqliteUnitOfWork } from '../infrastructure/sqlite/sqlite-unit-of-work';

export class ChangeUserPermissions {
  constructor(private readonly unitOfWork: SqliteUnitOfWork, private readonly users: SqliteUserStore) {}

  execute(issuer: string, subject: string, roles: { isRequester: boolean; isReviewer: boolean }): void {
    if (typeof roles.isRequester !== 'boolean' || typeof roles.isReviewer !== 'boolean') throw invalidInput('roles', 'مجوز باید مقدار منطقی داشته باشد.');
    this.unitOfWork.write(() => {
      if (!this.users.setPermissions(issuer, subject, roles)) throw invalidInput('subject', 'کاربر محلی در دسترس نیست.');
    });
  }
}
