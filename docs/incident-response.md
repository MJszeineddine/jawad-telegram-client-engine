# Incident Response

1. Contain: pause checkout, disable webhook or rotate bot token, revoke suspicious admin sessions, and stop workers if payment integrity is uncertain.
2. Preserve minimal evidence: timestamps, affected IDs, audit events, and provider responses—never copy secrets into tickets.
3. Assess scope: identity, attachments, invoices, transaction assignments, referrals, and group-monitor data.
4. Eradicate: rotate credentials, patch the defect, invalidate sessions, and remove malicious files.
5. Recover: restore from a verified backup, run migrations, replay only idempotent jobs, and compare assignment-ledger digest.
6. Communicate honestly to affected users where required.
7. Review and add a regression test before reopening checkout.

Bot token leak: use BotFather to revoke/regenerate the token, update runtime secret, reset webhook with a new secret, and inspect recent update/audit activity.
