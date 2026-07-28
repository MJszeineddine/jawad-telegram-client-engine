# Threat Model

| Threat | Control |
|---|---|
| Leaked bot token | Environment-only token, secret scan, rotation runbook, webhook secret. |
| Forged Mini App identity | HMAC validation, short auth-date window, no trust in `initDataUnsafe`. |
| Malicious upload | Extension/MIME/size allowlist, safe filename, non-public storage, optional ClamAV, no execution. |
| Prompt injection in logs | Deterministic engine; logs are data, not instructions; previews are redacted. |
| XSS/HTML injection | Escaping, CSP, no raw user HTML, safe JSON responses. |
| Flooding | Bot/API rate limits, queue backpressure, per-user wizard limits. |
| Invoice tampering | Server-owned invoice values and human-approved quotes. |
| Fake transaction | Receipt/status/log checks and configured chain/token/recipient. |
| Duplicate transaction | Unique immutable assignment ledger and idempotent verifier. |
| Ambiguous watcher match | Never auto-assign multiple candidates; manual review. |
| Admin-session theft | Secure, HttpOnly, SameSite cookies; short session; 2FA-ready identity provider. |
| Referral fraud | Unique attribution, duplicate/self-referral flags, manual commission payout. |
| Group overcollection | Explicit admin authorisation, per-group switch, excerpt-only retention, notify Jawad only. |
| Secrets in logs | Structured allowlist logging and redaction. |
| SSRF | Never automatically fetch submitted URLs; deny private network access in any future fetch service. |

## Out of scope

No offensive security testing, userbot automation, mass messaging, key custody, auto-refunds, or auto-payouts.
