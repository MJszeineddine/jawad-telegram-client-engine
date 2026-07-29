# Release Readiness — 29 July 2026

## Candidate

- Current GitHub commit: `d5759a8`.
- Safe demo: operational without Telegram, wallet, database, Redis, or AI credentials.
- Production architecture: Next.js web/Mini App, grammY bot, PostgreSQL, Redis/BullMQ worker, read-only TRON/Base verification, Docker Compose, and GitHub Actions.

## Locally verified

- Strict core TypeScript: pass.
- Strict web TypeScript: pass.
- Unit and source-contract tests: 92 pass.
- In-memory integration flow: pass.
- Full mock lead-to-paid-to-client-accepted flow: pass.
- Static build validation: pass.
- Secret scan: pass.
- Gitleaks staged and git-history scans: pass with redaction and no tracked leaks.
- High-severity dependency audit: pass.
- Migration inventory/transaction wrapper validation: pass through migration 013.
- Docker Compose PostgreSQL 17 migration and idempotence validation: pass in isolated local closure CI.
- Docker image build and health-probed web, bot, worker, PostgreSQL, and Redis startup: pass in isolated local closure CI.
- Backup and restore test against a disposable database: pass.
- Setup validator: pass in safe demo mode with expected warnings for intentionally absent production secrets.
- Synthetic production configuration validator: pass with ephemeral non-production values.
- Live dependency-free HTTP smoke test: pass on an isolated port; health, dashboard shell, and intake/qualification path verified.

## Connected verification status

The exact pushed commit has an owner-independent local closure equivalent at `scripts/closure-ci.sh`, with evidence under `evidence/closure/2026-07-29T12-07-06Z-6e6fedcc2776555716f7856a1687b482df087966/`. GitHub Actions remains `BLOCKED_EXTERNAL`: GitHub reports an account billing issue before any job starts, so no hosted CI result can become green until the repository owner clears that account state.

Production deployment remains intentionally blocked until the manual Telegram, wallet, DNS, and provider gates are completed.

## Known operational limitations

- Telegram Business integration is optional and depends on account eligibility and manual permissions.
- Real chain verification cannot run until receiving addresses and read-only provider endpoints are configured through `corepack pnpm payments:configure` in a local terminal.
- Public Base RPC is not suitable as the production provider.
- Direct dependency versions and the lockfile are pinned; install and CI use frozen-lockfile enforcement.
- ClamAV scanning is used only when available; file signature, MIME, extension, size, storage, and execution controls remain mandatory regardless.
- No automated refund, payout, repository access, arbitrary URL fetch, userbot, unsolicited DM, or private-group scrape exists.
