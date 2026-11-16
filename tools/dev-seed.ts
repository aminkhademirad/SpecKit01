import { withDevelopmentContext } from './development-context';

withDevelopmentContext(({ issuer, unit, users }) => {
  unit.write(() => {
    for (const [subject, isRequester, isReviewer] of [
      ['requester-a', true, false], ['reviewer-b', false, true],
      ['dual-c', true, true], ['reviewer-d', false, true],
    ] as const) users.provision(issuer, subject, { isRequester, isReviewer });
  });
  console.info('کاربران نمونه آماده شدند؛ ردیف و مجوز موجود بازنویسی نشد.');
});
