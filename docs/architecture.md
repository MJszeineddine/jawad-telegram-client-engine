# Architecture

## Services

- `apps/web`: Next.js Mini App and admin dashboard.
- `apps/bot`: grammY production adapter plus framework-independent bot command core.
- `apps/worker`: payment polling, notifications, retention, and queues through BullMQ/Redis.
- `apps/demo`: dependency-free safe local dashboard and API for a complete mock flow.
- `packages/domain`: lifecycle, capacity, attribution, and core types.
- `packages/qualification`: deterministic package/risk/acceptance output.
- `packages/payments`: invoice, matching, idempotency, and immutable assignment logic.
- `packages/telegram`: Mini App auth validation, attachments, redaction, and group scoring.
- `packages/database`: transactional PostgreSQL migrations.

## Trust boundaries

Telegram identity is accepted only after server validation. Admin actions require a least-privilege session. Uploaded files are untrusted bytes. User URLs are stored as text and are not automatically fetched. Blockchain providers are read-only data sources. The application never holds signing keys.

## Lead lifecycle

`NEW_LEAD → AWAITING_INFORMATION/AWAITING_REVIEW → QUOTE_SENT → AWAITING_PAYMENT → PAID → IN_PROGRESS → AWAITING_CLIENT_ACCEPTANCE → COMPLETED`

Terminal alternatives are `REJECTED` and `REFUNDED`. Illegal transitions fail closed.
