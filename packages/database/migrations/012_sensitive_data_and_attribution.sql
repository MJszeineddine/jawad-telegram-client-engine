BEGIN;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS recommended_package text;
UPDATE leads
SET recommended_package=qualification->>'recommendedPackage'
WHERE recommended_package IS NULL
  AND jsonb_typeof(qualification)='object'
  AND qualification ? 'recommendedPackage';
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_recommended_package_check;
ALTER TABLE leads ADD CONSTRAINT leads_recommended_package_check
  CHECK(recommended_package IS NULL OR recommended_package IN('QUICK_FIX','RESCUE','PRODUCTION_SPRINT','REJECT'));
CREATE INDEX IF NOT EXISTS leads_capacity_package_idx
  ON leads(recommended_package,status)
  WHERE status IN('awaiting_payment','paid','in_progress','awaiting_client_acceptance');
CREATE INDEX IF NOT EXISTS partner_events_identity_first_touch_idx
  ON partner_events(telegram_user_id,created_at,id)
  WHERE telegram_user_id IS NOT NULL;
COMMIT;
