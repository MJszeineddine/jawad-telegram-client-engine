BEGIN;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS accepted_by_telegram_user_id bigint;
UPDATE jobs SET accepted_at=COALESCE(accepted_at,updated_at) WHERE status='completed';
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS completed_requires_acceptance;
ALTER TABLE jobs ADD CONSTRAINT completed_requires_acceptance CHECK(status<>'completed' OR accepted_at IS NOT NULL);
CREATE INDEX IF NOT EXISTS jobs_acceptance_idx ON jobs(accepted_at) WHERE accepted_at IS NOT NULL;
COMMIT;
