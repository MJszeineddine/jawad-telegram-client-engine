BEGIN;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS included_work jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS refund_terms text NOT NULL DEFAULT 'Refunds are reviewed manually against the approved scope and acceptance test. No automatic refund or outgoing crypto transfer is performed.';
COMMIT;
