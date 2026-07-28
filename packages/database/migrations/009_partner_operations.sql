BEGIN;
CREATE TABLE IF NOT EXISTS partner_events(
  id bigserial PRIMARY KEY,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK(event_type IN('telegram_start')),
  telegram_user_id bigint,
  campaign text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS partner_start_identity_unique
  ON partner_events(partner_id,event_type,telegram_user_id)
  WHERE telegram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS partner_events_partner_created_idx ON partner_events(partner_id,created_at DESC);
COMMIT;
