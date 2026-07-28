# Release Readiness — 28 July 2026

## Candidate

- Base GitHub commit: `9db9da2`.
- Current hardening changes: pending one final repository commit and push.
- Safe demo: operational without Telegram, wallet, database, Redis, or AI credentials.
- Production architecture: Next.js web/Mini App, grammY bot, PostgreSQL, Redis/BullMQ worker, read-only TRON/Base verification, Docker Compose, and GitHub Actions.

## Locally verified

- Strict core TypeScript: pass.
- Strict web TypeScript: pass.
- Unit and source-contract tests: 82 pass.
- In-memory integration flow: pass.
- Full mock lead-to-paid-to-client-accepted flow: pass.
- Static build validation: pass.
- Secret scan: pass.
- Migration inventory/transaction wrapper validation: pass through migration 013.
- Setup validator: pass in safe demo mode with expected warnings for intentionally absent production secrets.
- Synthetic production configuration validator: pass with ephemeral non-production values.
- Live dependency-free HTTP smoke test: pass on an isolated port; health, dashboard shell, and intake/qualification path verified.

## Connected verification still required before deployment

The isolated build environment has no Docker daemon, PostgreSQL client, package-registry DNS, Telegram token, wallets, RPC credentials, domain, or deployment account. Therefore the exact pushed commit must still pass the repository CI job that executes PostgreSQL migrations/integration tests, the real Next.js build, Playwright, dependency audit, and gitleaks. Production deployment remains intentionally blocked until the manual Telegram, wallet, DNS, and provider gates are completed.

## Known operational limitations

- Telegram Business integration is optional and depends on account eligibility and manual permissions.
- Real chain verification cannot run until receiving addresses and read-only provider endpoints are configured.
- Public Base RPC is not suitable as the production provider.
- Direct dependency versions are pinned. The final registry-connected handoff generates and commits `pnpm-lock.yaml`; connected CI then installs with `--frozen-lockfile`.
- ClamAV scanning is used only when available; file signature, MIME, extension, size, storage, and execution controls remain mandatory regardless.
- No automated refund, payout, repository access, arbitrary URL fetch, userbot, unsolicited DM, or private-group scrape exists.
