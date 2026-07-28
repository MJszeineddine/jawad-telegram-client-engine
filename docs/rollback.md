# Rollback Guide

1. Pause checkout and webhook processing.
2. Record the current image tag and migration version.
3. Roll application containers back to the last verified image.
4. Do not automatically reverse a database migration containing new payment assignments.
5. For additive migrations, keep the schema and roll back code. For destructive change, restore to an isolated database first and reconcile immutable payment assignments before cutover.
6. Restart workers with idempotency keys intact.
7. Run health, lead-read, quote-read, and payment-assignment integrity checks.
8. Re-enable webhook first, then checkout only after Jawad approves.
