# Testing Strategy

## Local release gate

`npm run qa` is the dependency-light release gate. It runs:

- source lint and repository policy checks;
- strict core and web TypeScript checks;
- deterministic unit and contract tests;
- in-memory integration flow;
- full mock partner-link → intake → quote → payment → paid job → delivery → client acceptance → referral flow;
- static production-build validation;
- secret scanning;
- dependency-policy validation;
- migration inventory and transactional SQL validation;
- environment/setup validation.

The current release candidate contains 92 passing unit and contract tests. Tests cover qualification, lifecycle and capacity locking, Telegram init-data and start-parameter authentication, Redis-backed production rate limiting, bounded request bodies, attachment signatures and cleanup, client/admin access separation, encrypted sensitive fields, payment mismatch and transaction-reuse controls, canonical transaction hashes, delivery evidence, client acceptance, privacy deletion, referrals, bot update idempotency, worker ambiguity handling, terminal-only payment configuration, and container runtime contracts.

## Connected infrastructure gate

The GitHub Actions workflow additionally:

1. starts PostgreSQL and Redis service containers;
2. installs the pinned workspace dependency graph from `pnpm-lock.yaml` with frozen-lockfile enforcement;
3. applies every migration through `013_financial_integrity.sql`;
4. seeds deterministic test records;
5. enables the PostgreSQL repository integration suite, including concurrent payment assignment and encrypted-field round trips;
6. builds the real Next.js production application;
7. installs Chromium and runs Playwright mobile, desktop, overflow, and accessibility checks;
8. runs the package vulnerability audit and gitleaks.

A release must not be deployed if this connected-infrastructure gate is red for an application failure. As of 29 July 2026, the GitHub Actions gate is blocked before job execution by the repository owner's GitHub account billing state. The owner-independent local closure gate in `scripts/closure-ci.sh` exercises the same PostgreSQL, Redis, Next.js, Playwright, dependency-audit, Gitleaks, Docker image, health, backup, and restore checks in an isolated Compose project.

No fixture represents a real client, real payment, or testimonial.
