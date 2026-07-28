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
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*token/i);
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
      DATABASE_URL: "postgresql://jawad:jawad@localhost:5432/jawad_engine",
      REDIS_URL: "redis://localhost:6379",
      ADMIN_SESSION_SECRET: randomBytes(48).toString("base64url"),
      DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      ADMIN_PASSWORD_SHA256: createHash("sha256").update("temporary-local-password").digest("hex"),
      TELEGRAM_BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyzABCDE",
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
