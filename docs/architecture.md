# Architecture

## Services

- `apps/web`: Next.js Telegram Mini App and least-privilege admin dashboard.
- `apps/bot`: grammY production adapter plus framework-independent bot command/intake core.
- `apps/worker`: read-only payment polling, Telegram notifications, expiry, retention, and BullMQ/Redis queues.
- `apps/demo`: dependency-free safe local dashboard and API for a complete mock flow.
- `packages/domain`: lifecycle, capacity, attribution, and core types.
- `packages/qualification`: deterministic package/risk/acceptance output.
- `packages/payments`: chain normalisation, invoice matching, idempotency, and immutable assignment logic.
- `packages/telegram`: Mini App authentication, attachments, redaction, rate primitives, and group scoring.
- `packages/database`: transactional PostgreSQL repository and migrations.

## Trust boundaries

Telegram identity and referral attribution are accepted only from validated `initData`. Admin actions require a signed owner session and CSRF token. Uploaded files are untrusted bytes. User URLs are stored as text and are not automatically fetched. Blockchain providers are read-only data sources. PostgreSQL stores the durable commercial state; Redis stores queues, bot wizard state, and production API rate counters. The application never holds signing keys.

Sensitive commercial and personal fields use authenticated application-layer encryption before PostgreSQL persistence. Database constraints and transactions protect state invariants that must survive a compromised or duplicated web request.

## Lead lifecycle

`NEW_LEAD → AWAITING_INFORMATION/AWAITING_REVIEW → QUOTE_SENT → AWAITING_PAYMENT → PAID → IN_PROGRESS → AWAITING_CLIENT_ACCEPTANCE → COMPLETED`

Terminal alternatives are `REJECTED` and `REFUNDED`. Illegal transitions fail closed. Admin delivery stops at `AWAITING_CLIENT_ACCEPTANCE`; only the Telegram-bound client acceptance operation records `accepted_at` and completes the job.
