# Production Deployment

## Preconditions

- An approved HTTPS domain.
- Managed PostgreSQL and Redis or equivalent private services.
- Container provider credentials and billing approval.
- Bot token, webhook secret, admin chat ID, receiving addresses, and read-only chain credentials in the provider secret manager.

## Procedure

1. Build the image from `Dockerfile` and run CI.
2. Provision PostgreSQL with encrypted storage and backups; provision Redis without public access.
3. Apply migrations using a one-off release job.
4. Deploy web, bot, and worker with health checks and restart policies.
5. Configure HTTPS, `APP_BASE_URL`, and Mini App URL.
6. Configure Telegram webhook with secret-token verification and only required update types.
7. Send a signed test notification to Jawad.
8. Use a test invoice or chain testnet fixture before accepting production payments.
9. Run `pnpm db:backup`, move the archive to approved encrypted private storage, and prove an isolated restore with `pnpm db:restore-test -- /path/to/archive.dump`.
10. Verify rollback, logs, rate limits, attachment deletion, and no-secret output.
11. Enable payment only after wallet/network labels are visually checked by Jawad.

The public Base endpoint is rate-limited and should not be used as the production provider. No paid resource should be created without Jawad's approval.
