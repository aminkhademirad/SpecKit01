import { invalidInput } from '../src/domain/errors';
import { cliArguments, withDevelopmentContext } from './development-context';

withDevelopmentContext(({ issuer, permissions }) => {
  const args = cliArguments(['subject', 'requester', 'reviewer']);
  if (![args.requester, args.reviewer].every(value => value === 'true' || value === 'false')) throw invalidInput('roles', 'مقدار مجوز باید true یا false باشد.');
  permissions.execute(issuer, args.subject!, { isRequester: args.requester === 'true', isReviewer: args.reviewer === 'true' });
  console.info('مجوز فعلی در تراکنش ثبت شد.');
});
