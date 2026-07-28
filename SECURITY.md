# Security Policy

Report a vulnerability privately to `mjawadzeineddine@gmail.com`. Do not test production destructively, access other users' data, publish secrets, or demand payment before disclosure.

## Security properties

- The application stores no private keys, seed phrases, recovery phrases, Telegram OTPs, or session strings.
- Wallets are receiving addresses only. All outgoing crypto actions, refunds, and referral payouts happen manually outside the application.
- Telegram Mini App identity and referral start parameters are accepted only after server-side HMAC and freshness validation.
- Production cannot fall back to demo identity, demo credentials, or synthetic dashboard records.
- Sensitive intake, qualification, quote, job, conversation, testimonial, deletion-request, demand-signal, and attachment-name fields use authenticated encryption at rest.
- Client ticket responses omit owner-only notes and physical storage keys.
- Public JSON bodies and Telegram downloads have hard byte and time limits.
- Production web rate limits are enforced atomically in Redis and fail closed if Redis is unavailable; identifiers are SHA-256 hashed before becoming Redis keys.
- Payment confirmation is read-only, idempotent, transaction hashes are canonicalised, token/network pairs are database-constrained, and one transaction cannot be assigned twice.
- A job cannot become completed through an admin shortcut. Delivery evidence is required, and completion requires acceptance by the Telegram identity bound to the lead.

Rotate an exposed Telegram token immediately through BotFather, replace webhook and application secrets, revoke sessions, review audit logs, and run the incident-response procedure.
