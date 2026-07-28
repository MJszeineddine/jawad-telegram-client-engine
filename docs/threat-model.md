# Threat Model

| Threat | Control |
|---|---|
| Leaked bot token | Environment-only token, secret scan, rotation runbook, webhook secret. |
| Forged Mini App identity or partner attribution | HMAC validation, short auth-date window, positive Telegram user ID, and signed `start_param`; never trust `initDataUnsafe` or a body-supplied partner slug. |
| Production demo fallback | `NODE_ENV=production` always disables demo mode; missing production identity/configuration fails closed. |
| Malicious upload | Extension/MIME/size allowlist, file-signature verification, safe filename, non-public storage, bounded Telegram download, optional ClamAV, cleanup on persistence failure, and no execution. |
| Oversized or slow request body | Streamed byte caps, content-type enforcement, timeout-bounded Telegram downloads, and no unbounded `arrayBuffer()` path. |
| Prompt injection in logs | Deterministic engine; logs are data, not instructions; previews are redacted. |
| XSS/HTML injection | Escaping, route-specific CSP/framing policy, no raw user HTML, and safe JSON responses. |
| Flooding, spoofed client IP, and multi-replica bypass | Atomic Redis rate limits in production, hashed keys, a configured proxy-overwritten client-IP header, bot flood controls, queue backpressure, and per-user wizard limits. Redis or proxy-header uncertainty denies/buckets the protected mutation instead of silently bypassing limits. |
| Invoice tampering | Server-owned invoice values, database token/network constraints, capacity locking, and human-approved quotes. |
| Fake transaction | Read-only receipt/status/log checks against configured chain, token, recipient, amount, confirmation count, and invoice window. |
| Transaction hash casing/prefix bypass | Network-aware canonical transaction hashes before idempotency and uniqueness checks. |
| Duplicate transaction or concurrent confirmation | Unique immutable assignment ledger, row locks, and winner revalidation after concurrent insert. |
| Ambiguous watcher match | Never auto-assign multiple candidates; mark for manual review. |
| Admin-session theft or CSRF | Signed HttpOnly SameSite cookie, role binding, expiry, same-origin checks, and session-bound CSRF token. |
| Client data disclosure | Telegram-bound reads/downloads, separate client DTOs, no internal notes or storage keys, encrypted sensitive fields. |
| False delivery completion | Admin can only move to awaiting acceptance after proof and test evidence; only the bound client can complete the job. |
| Referral fraud | Signed first-touch attribution, serialised identity lock, duplicate/self-referral flags, delivery-and-acceptance eligibility, and manual payout. |
| Group overcollection | Explicit admin authorisation, per-group switch, category/threshold/quiet-hour controls, encrypted excerpt retention, and private alerts only. |
| Secrets in logs | Structured allowlist logging and redaction. |
| SSRF | Submitted URLs are stored as text and never automatically fetched; future fetch services must deny private/link-local networks. |
| Database or Redis outage | Production readiness returns 503 and protected API limits fail closed. |

## Out of scope

No offensive security testing, userbot automation, mass messaging, key custody, auto-refunds, auto-payouts, arbitrary client URL fetching, or unattended repository access.
