import { invalidInput } from '../src/domain/errors';
import { cliArguments, withDevelopmentContext } from './development-context';

withDevelopmentContext(({ issuer, users, jwt }) => {
  const subject = cliArguments(['subject']).subject!;
  if (!users.find(issuer, subject)) throw invalidInput('subject', 'کاربر محلی در دسترس نیست.');
  console.info(jwt.issue(subject));
});
