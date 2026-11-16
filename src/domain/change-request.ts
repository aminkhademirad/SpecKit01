export const REQUEST_STATUSES = ['Draft', 'PendingReview', 'ChangesRequested', 'Approved'] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];

export const CONTENT_LIMITS = Object.freeze({ title: 200, description: 5000, reason: 2000 });
export const CONTENT_MIN_SCALARS = 1;
export const CONTENT_TRIM_REQUIRED = true;

export interface ChangeRequest {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly reason: string;
  readonly requesterId: string;
  readonly status: RequestStatus;
  readonly version: string;
}
