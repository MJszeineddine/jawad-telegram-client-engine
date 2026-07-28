# Jawad Telegram Client Engine

A safe Telegram-based client-acquisition, technical-intake, qualification, quote, crypto-invoice, paid-job, referral, and opt-in demand-monitoring system for **Jawad Dev Desk**.

## What is implemented

- Deterministic intake qualification for Quick Fix, Rescue, Production Sprint, and rejection.
- Human-approved quote and capacity workflow.
- Idempotent read-only transaction assignment with canonical hashes, database token/network constraints, wrong-chain, wrong-token, wrong-recipient, insufficient-value, confirmation, duplicate, expiry, late-payment, and ambiguity controls.
- Signed Telegram deep-link attribution, Mini App init-data validation, command UX, bounded and signature-checked attachments, secret redaction, and authorised-group demand scoring.
- Mobile-first safe local dashboard and API demo requiring no Telegram token, wallet, RPC, PostgreSQL, Redis, or AI key.
- Encrypted sensitive fields, Redis-backed production API rate limits, client-bound delivery acceptance, Next.js 16.2.12, grammY, PostgreSQL migrations, BullMQ, Docker Compose, CI, threat model, runbooks, and setup material.

## Safe local demo

```bash
npm run qa
npm run dev
# open http://localhost:3100
```

The safe demo uses synthetic data and mocked, normalised blockchain transfers. It never claims a real client, payment, or job.

## Live local Telegram bot

After BotFather creation and secure token storage, the owner can run one audited bootstrap command:

```bash
corepack pnpm telegram:bootstrap
```

The bootstrap verifies the bot identity, applies the name/description/commands through the official Bot API, pairs the private owner chat with a one-time code, creates local secrets without printing them, starts PostgreSQL and Redis, applies migrations and seed data, and launches the bot in long-polling mode. An HTTP localhost URL is never registered as a Telegram Mini App menu; the menu remains command-based until a verified HTTPS deployment URL exists.

## Production workspace

When package-registry access and Docker are available:

```bash
corepack enable
pnpm install
cp .env.example .env
# fill only non-secret public settings first
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Real wallet addresses, bot tokens, RPC credentials, and webhook secrets belong only in the runtime environment. Never commit them.

## Manual gates

Telegram account OTP, two-step verification, BotFather bot creation, channel creation, admin assignment, receiving-wallet configuration, GitHub authentication, DNS, deployment login, billing approval, and production credentials require Jawad's manual action. See `docs/manual-gates.md`.

## Commands

`npm run qa` runs lint, strict core/web typechecks, the complete unit and contract suite, integration tests, full mock E2E, build validation, secret scan, dependency policy, migration inventory, and repository/setup validation. The exact pushed commit must also pass the connected PostgreSQL/Redis/Next.js/Playwright GitHub Actions gate before deployment. See `docs/release-readiness.md`.

## Safety boundary

No userbots, mass DMs, private-group scraping, contact harvesting, unsolicited automatic replies, OTP automation, private keys, seed phrases, automatic payouts/refunds, automatic repository access, or intrusive production scanning.
