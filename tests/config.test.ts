import test from "node:test";
import assert from "node:assert/strict";
import { resolveMiniAppUrl } from "../packages/config/src/index.ts";

test("Telegram Mini App menu is configured only with a valid HTTPS URL", () => {
  assert.equal(resolveMiniAppUrl({ MINI_APP_URL: "https://desk.example/mini-app" }), "https://desk.example/mini-app");
  assert.equal(resolveMiniAppUrl({ MINI_APP_URL: "http://localhost:3100/mini-app" }), undefined);
  assert.equal(resolveMiniAppUrl({ APP_BASE_URL: "https://desk.example" }), "https://desk.example/mini-app");
  assert.equal(resolveMiniAppUrl({ APP_BASE_URL: "not a URL" }), undefined);
});

test("local runtime scripts load .env without overriding explicit process variables", async () => {
  const { readFile } = await import("node:fs/promises");
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as { scripts: Record<string, string> };
  for (const script of ["dev", "dev:bot", "dev:worker", "db:migrate", "db:seed", "setup:validate", "db:backup", "db:restore-test"]) {
    assert.match(packageJson.scripts[script] ?? "", /--env-file-if-exists=\.env/);
  }
});

test("Telegram bootstrap is token-safe, pairs the owner, and launches long polling without an HTTP Mini App URL", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../scripts/bootstrap-telegram.ts", import.meta.url), "utf8");
  assert.match(source, /\/pair \$\{pairCode\}/);
  assert.match(source, /deleteWebhook/);
  assert.match(source, /setMyCommands/);
  assert.match(source, /setChatMenuButton/);
  assert.match(source, /pnpm", "dev:bot/);
  assert.match(source, /localhost:55432\/jawad_engine/);
  assert.match(source, /Admin chat paired: yes/);
  assert.doesNotMatch(source, /Admin chat paired: \$\{/);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*token/i);
});

test("local Docker stack avoids common host ports and binds services to loopback", async () => {
  const { readFile } = await import("node:fs/promises");
  const compose = await readFile(new URL("../docker-compose.yml", import.meta.url), "utf8");
  const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
  const dockerignore = await readFile(new URL("../.dockerignore", import.meta.url), "utf8");

  assert.match(compose, /postgres:17-alpine/);
  assert.match(compose, /127\.0\.0\.1:\$\{POSTGRES_HOST_PORT:-55432\}:5432/);
  assert.match(compose, /127\.0\.0\.1:\$\{REDIS_HOST_PORT:-6379\}:6379/);
  assert.match(compose, /127\.0\.0\.1:\$\{LOCAL_WEB_PORT:-3100\}:3000/);
  assert.match(compose, /BOT_WEBHOOK_PORT: \$\{LOCAL_BOT_HEALTH_PORT:-3101\}/);
  assert.match(compose, /WORKER_HEALTH_PORT: \$\{LOCAL_WORKER_HEALTH_PORT:-3200\}/);
  assert.match(compose, /env_file: \$\{COMPOSE_ENV_FILE:-\.env\}/);
  assert.doesNotMatch(compose, /"3000:3000"/);
  assert.match(dockerfile, /pnpm install --frozen-lockfile/);
  assert.match(dockerignore, /\*\*\/node_modules/);
  assert.match(dockerignore, /\*\*\/\.next/);
});

test("backup and restore Docker fallbacks are limited to the local Compose database", async () => {
  const { readFile } = await import("node:fs/promises");
  const backup = await readFile(new URL("../scripts/backup-database.ts", import.meta.url), "utf8");
  const restore = await readFile(new URL("../scripts/restore-test.ts", import.meta.url), "utf8");

  for (const source of [backup, restore]) {
    assert.match(source, /localComposeDatabaseName/);
    assert.match(source, /parsed\.hostname==="localhost"\|\|parsed\.hostname==="127\.0\.0\.1"/);
    assert.match(source, /process\.env\.POSTGRES_HOST_PORT\?\?"55432"/);
    assert.match(source, /parsed\.port===port/);
    assert.match(source, /parsed\.username==="jawad"/);
  }
  assert.doesNotMatch(backup, /"-d","jawad_engine"/);
});

test("live local Telegram mode validates without wallet or HTTPS deployment credentials", async () => {
  const { spawnSync } = await import("node:child_process");
  const { randomBytes, createHash } = await import("node:crypto");
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/setup-validator.ts"], {
    cwd: new URL("..", import.meta.url).pathname,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "development",
      DEMO_MODE: "false",
      APP_BASE_URL: "http://localhost:3100",
      DATABASE_URL: "postgresql://jawad:jawad@localhost:55432/jawad_engine",
      REDIS_URL: "redis://localhost:6379",
      ADMIN_SESSION_SECRET: randomBytes(48).toString("base64url"),
      DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      ADMIN_PASSWORD_SHA256: createHash("sha256").update("temporary-local-password").digest("hex"),
      TELEGRAM_BOT_TOKEN: `123456789:${"abcdefghijklmnopqrstuvwxyzABCDE"}`,
      TELEGRAM_ADMIN_CHAT_ID: "123456789",
      TELEGRAM_BOT_USERNAME: "JawadDevDeskBot",
      TELEGRAM_WEBHOOK_SECRET: randomBytes(32).toString("base64url"),
      TRON_API_BASE_URL: "https://api.trongrid.io",
    },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Setup validation PASS \(live-local mode\)/);
  assert.match(result.stderr, /No receiving wallet is configured/);
});
