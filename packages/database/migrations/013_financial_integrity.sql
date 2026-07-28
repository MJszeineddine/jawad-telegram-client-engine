BEGIN;
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_currency_network_pair;
ALTER TABLE quotes ADD CONSTRAINT quotes_currency_network_pair CHECK(
  (currency='USDT' AND network='TRON_TRC20') OR
  (currency='USDC' AND network='BASE_USDC')
);
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_token_network_pair;
ALTER TABLE invoices ADD CONSTRAINT invoices_token_network_pair CHECK(
  (token='USDT' AND network='TRON_TRC20') OR
  (token='USDC' AND network='BASE_USDC')
);
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_reference_usd_nonnegative;
ALTER TABLE invoices ADD CONSTRAINT invoices_reference_usd_nonnegative CHECK(reference_usd_minor IS NULL OR reference_usd_minor>=0);
COMMIT;
