BEGIN;
ALTER TABLE group_monitors ADD COLUMN IF NOT EXISTS approved_template text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS last_error text;
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications(recipient_chat_id,created_at DESC);
COMMIT;
