# Operations Runbook

## Daily

- Review new leads, missing information, risk flags, payment ambiguity, deadlines, and capacity.
- Approve or edit every quote manually.
- Never send an outgoing crypto transaction from this system.

## Weekly

- Test a synthetic intake-to-paid flow.
- Review authorised group monitors and remove stale groups.
- Check attachment deletion and queue failures.
- Review dependency and security advisories.

## Monthly

- Run `pnpm db:backup`, copy the encrypted-at-rest archive to the approved private backup destination, and record the location reference without exporting runtime environment variables.
- Restore the latest archive into a separate disposable PostgreSQL database with `RESTORE_DATABASE_URL=... pnpm db:restore-test -- /path/to/archive.dump`. The script refuses to target the configured source database.
- Rotate low-impact secrets when practical and verify emergency token-rotation access.
- Review retention, referral fraud flags, and audit-log access.

## Payment ambiguity

Do not guess. Compare network, token, recipient, amount, timestamps, confirmations, and whether the transaction is already assigned. Use manual override only with an audit note.

## Backup failure

Do not delete the previous known-good archive. Check free disk space and PostgreSQL client compatibility, rerun the backup, and keep payment acceptance paused when no recoverable database copy exists. Backup archives contain business data and must remain private; they intentionally exclude wallet private keys because the application never stores any.
