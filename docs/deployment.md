# Production Deployment

## Preconditions

- An approved HTTPS domain.
- Managed PostgreSQL and Redis or equivalent private services.
- Container-provider credentials and billing approval.
- Bot token, webhook secret, admin chat ID, receiving addresses, and read-only chain credentials in the provider secret manager.
- A green connected-infrastructure CI run for the exact commit being deployed.

## Procedure

1. Build the image from `Dockerfile` and require the CI quality job to pass.
2. Provision PostgreSQL with encrypted storage and backups; provision Redis with persistence/authentication and no public network access. Configure `TRUSTED_PROXY_HEADER` only for a reverse-proxy header that the provider overwrites and strips from direct client input.
3. Apply migrations using the one-off `migrate` release job. Do not start payment intake if any migration fails.
4. Deploy web, bot, and worker with health checks and restart policies.
5. Configure HTTPS, `APP_BASE_URL`, and `MINI_APP_URL`.
6. Configure the Telegram webhook with secret-token verification and only required update types.
7. Confirm `/api/health`, bot `/health`, and worker `/health` are ready. Web readiness requires both PostgreSQL and Redis.
8. Send a signed test notification to Jawad.
9. Use a test invoice or verified fixture before accepting production payments.
10. Run `pnpm db:backup`, move the archive to approved encrypted private storage, and prove an isolated restore with `pnpm db:restore-test -- /path/to/archive.dump`.
11. Verify rate limits across two web replicas, attachment deletion, queue retries, audit logs, and no-secret output.
12. Enable payment only after wallet, network, token contract, and confirmation labels are visually checked by Jawad.

The public Base endpoint is rate-limited and should not be used as the production provider. No paid resource should be created without Jawad's approval. No deployment is considered verified until HTTPS, webhook delivery, database/Redis readiness, backup restore evidence, and a complete synthetic lead-to-accepted-job flow pass in that environment.
