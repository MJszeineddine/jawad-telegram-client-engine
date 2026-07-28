BEGIN;
CREATE TABLE processed_telegram_updates(
  update_id bigint PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  outcome text NOT NULL DEFAULT 'received',
  payload_digest text NOT NULL
);
CREATE TABLE payment_verification_attempts(
  id bigserial PRIMARY KEY,
  invoice_id uuid REFERENCES invoices(id),
  tx_hash text NOT NULL,
  provider text NOT NULL,
  outcome text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}',
  attempted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE group_monitors ADD COLUMN authorised_by text;
ALTER TABLE group_monitors ADD COLUMN authorised_at timestamptz;
ALTER TABLE group_monitors ADD CONSTRAINT group_monitor_authorisation CHECK(NOT enabled OR (admin_authorised AND authorised_by IS NOT NULL AND authorised_at IS NOT NULL));
CREATE INDEX payment_attempt_invoice_idx ON payment_verification_attempts(invoice_id,attempted_at DESC);
CREATE INDEX processed_updates_received_idx ON processed_telegram_updates(received_at);
COMMIT;
