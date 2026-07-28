BEGIN;
ALTER TABLE group_monitors
  ADD COLUMN IF NOT EXISTS keyword_categories jsonb NOT NULL DEFAULT '["developer_request","react_next","node_api","production_deployment","database_auth","urgent_today","unfinished_handoff"]'::jsonb;
ALTER TABLE group_monitors
  ADD CONSTRAINT group_monitor_keyword_categories_array CHECK(jsonb_typeof(keyword_categories)='array');
COMMIT;
