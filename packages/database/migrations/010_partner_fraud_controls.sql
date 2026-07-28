BEGIN;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS owner_telegram_user_id bigint;
CREATE INDEX IF NOT EXISTS partners_owner_telegram_idx ON partners(owner_telegram_user_id) WHERE owner_telegram_user_id IS NOT NULL;
COMMIT;
