CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL CHECK (version > 0),
  checksum TEXT NOT NULL CHECK (length(checksum) = 64)
) STRICT;

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL CHECK (
    length(id) = 36 AND substr(id,9,1) = '-' AND substr(id,14,1) = '-'
    AND substr(id,19,1) = '-' AND substr(id,24,1) = '-'
    AND length(replace(id,'-','')) = 32 AND lower(replace(id,'-','')) NOT GLOB '*[^0-9a-f]*'
  ),
  issuer TEXT NOT NULL CHECK (length(trim(issuer)) > 0),
  subject TEXT NOT NULL CHECK (length(trim(subject)) > 0),
  isRequester INTEGER NOT NULL DEFAULT 0 CHECK (isRequester IN (0,1)),
  isReviewer INTEGER NOT NULL DEFAULT 0 CHECK (isReviewer IN (0,1)),
  UNIQUE (issuer, subject)
) STRICT;

CREATE TABLE change_requests (
  id TEXT PRIMARY KEY NOT NULL CHECK (
    length(id) = 36 AND substr(id,9,1) = '-' AND substr(id,14,1) = '-'
    AND substr(id,19,1) = '-' AND substr(id,24,1) = '-'
    AND length(replace(id,'-','')) = 32 AND lower(replace(id,'-','')) NOT GLOB '*[^0-9a-f]*'
  ),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reason TEXT NOT NULL,
  requesterId TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('Draft','PendingReview','ChangesRequested','Approved')),
  version TEXT NOT NULL CHECK (
    length(version) = 36 AND substr(version,9,1) = '-' AND substr(version,14,1) = '-'
    AND substr(version,19,1) = '-' AND substr(version,24,1) = '-'
    AND length(replace(version,'-','')) = 32 AND lower(replace(version,'-','')) NOT GLOB '*[^0-9a-f]*'
  )
) STRICT;

CREATE TRIGGER immutable_request_identity
BEFORE UPDATE OF id, requesterId ON change_requests
WHEN NEW.id <> OLD.id OR NEW.requesterId <> OLD.requesterId
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_REQUEST_IDENTITY');
END;
