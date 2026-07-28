import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { chmod, mkdir, open, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const envPath = resolve(root, ".env");
const runtimeDir = resolve(root, "runtime");
const logDir = resolve(runtimeDir, "logs");
const pidPath = resolve(runtimeDir, "bot.pid");
const logPath = resolve(logDir, "bot.log");

function parseEnv(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    values[line.slice(0, separator).trim()] = line.slice(separator + 1);
  }
  return values;
}

function mergeEnv(text: string, updates: Record<string, string>): string {
  const output: string[] = [];
  const written = new Set<string>();
  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine && output.length === 0) continue;
    const separator = rawLine.indexOf("=");
    const key = separator > 0 ? rawLine.slice(0, separator).trim() : "";
    if (key && Object.hasOwn(updates, key)) {
      output.push(`${key}=${updates[key]}`);
      written.add(key);
    } else if (rawLine) output.push(rawLine);
  }
  for (const [key, value] of Object.entries(updates)) if (!written.has(key)) output.push(`${key}=${value}`);
  return `${output.join("\n").trim()}\n`;
}

async function telegram<T>(token: string, method: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(35_000),
  });
  const payload = await response.json() as { ok?: boolean; result?: T; description?: string };
  if (!response.ok || !payload.ok) throw new Error(`${method}: ${payload.description ?? `HTTP ${response.status}`}`);
  return payload.result as T;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with status ${result.status ?? "unknown"}`);
}

function commandExists(command: string, args: string[]): boolean {
  const result = spawnSync(command, args, { cwd: root, stdio: "ignore" });
  return !result.error && result.status === 0;
}

async function stopPreviousBot(): Promise<void> {
  try {
    const pid = Number((await readFile(pidPath, "utf8")).trim());
    if (Number.isInteger(pid) && pid > 1) {
      try { process.kill(pid, "SIGTERM"); } catch {}
      await new Promise(resolveDelay => setTimeout(resolveDelay, 800));
    }
  } catch {}
}

const existingText = await readFile(envPath, "utf8").catch(() => "");
const existing = parseEnv(existingText);
const token = existing.TELEGRAM_BOT_TOKEN?.trim();
if (!token || !token.includes(":")) throw new Error("TELEGRAM_BOT_TOKEN is missing or invalid in .env");

const me = await telegram<{ id: number; username?: string }>(token, "getMe");
const username = me.username;
if (username !== "JawadDevDeskBot") throw new Error(`Token belongs to @${username ?? "unknown"}, not @JawadDevDeskBot`);

const commands = [
  ["start", "Open the Dev Desk"], ["fix", "Submit one technical bug"], ["agency", "Submit agency overflow work"],
  ["rescue", "Request production rescue"], ["portfolio", "View engineering work"], ["services", "View supported services"],
  ["pricing", "View starting packages"], ["availability", "Check current capacity"], ["payment", "View supported crypto payments"],
  ["status", "Check an existing ticket"], ["privacy", "View privacy and security rules"], ["cancel", "Cancel the current submission"],
  ["help", "Get help"],
].map(([command, description]) => ({ command, description }));

await telegram(token, "setMyName", { name: "Jawad Dev Desk" });
await telegram(token, "setMyDescription", { description: "Submit a web-app bug, production rescue request, or white-label agency task. Receive a clear scope, acceptance test, delivery window, and crypto invoice." });
await telegram(token, "setMyShortDescription", { short_description: "Full-stack production rescue and agency overflow engineering by Jawad Zeineddine." });
await telegram(token, "setMyCommands", { commands });
await telegram(token, "setChatMenuButton", { menu_button: { type: "commands" } });
await telegram(token, "deleteWebhook", { drop_pending_updates: false });

const pairCode = randomBytes(4).toString("hex").toUpperCase();
console.log(`\nOpen https://t.me/${username} and send exactly: /pair ${pairCode}`);
console.log("Waiting up to 3 minutes for the private pairing message…");

let offset: number | undefined;
const latest = await telegram<Array<{ update_id: number }>>(token, "getUpdates", { offset: -1, timeout: 0, limit: 1, allowed_updates: ["message"] });
if (latest.length) offset = latest[0]!.update_id + 1;
let adminChatId: string | undefined;
const deadline = Date.now() + 180_000;
while (Date.now() < deadline && !adminChatId) {
  const updates = await telegram<Array<{ update_id: number; message?: { text?: string; chat?: { id?: number; type?: string } } }>>(token, "getUpdates", {
    ...(offset === undefined ? {} : { offset }), timeout: 20, limit: 20, allowed_updates: ["message"],
  });
  for (const update of updates) {
    offset = update.update_id + 1;
    const message = update.message;
    if (message?.chat?.type === "private" && message.text?.trim() === `/pair ${pairCode}` && Number.isSafeInteger(message.chat.id)) {
      adminChatId = String(message.chat.id);
      break;
    }
  }
}
if (!adminChatId) throw new Error("Pairing timed out. No configuration was changed beyond safe Bot API metadata.");

const updates: Record<string, string> = {
  NODE_ENV: "development",
  DEMO_MODE: "false",
  APP_BASE_URL: existing.APP_BASE_URL || "http://localhost:3100",
  MINI_APP_URL: existing.MINI_APP_URL || "",
  DATABASE_URL: existing.DATABASE_URL || "postgresql://jawad:jawad@localhost:55432/jawad_engine",
  REDIS_URL: existing.REDIS_URL || "redis://localhost:6379",
  TRUSTED_PROXY_HEADER: existing.TRUSTED_PROXY_HEADER || "x-real-ip",
  TELEGRAM_BOT_TOKEN: token,
  TELEGRAM_BOT_USERNAME: username,
  TELEGRAM_ADMIN_CHAT_ID: adminChatId,
  TELEGRAM_WEBHOOK_SECRET: existing.TELEGRAM_WEBHOOK_SECRET || randomBytes(32).toString("base64url"),
  ADMIN_SESSION_SECRET: existing.ADMIN_SESSION_SECRET || randomBytes(48).toString("base64url"),
  DATA_ENCRYPTION_KEY: existing.DATA_ENCRYPTION_KEY || randomBytes(32).toString("base64"),
  ATTACHMENT_ROOT: existing.ATTACHMENT_ROOT || "./runtime/uploads",
  ATTACHMENT_MAX_BYTES: existing.ATTACHMENT_MAX_BYTES || "10485760",
  DATA_RETENTION_DAYS: existing.DATA_RETENTION_DAYS || "90",
  TRON_API_BASE_URL: existing.TRON_API_BASE_URL || "https://api.trongrid.io",
  BASE_CHAIN_ID: existing.BASE_CHAIN_ID || "8453",
  PAYMENT_CONFIRMATIONS_TRON: existing.PAYMENT_CONFIRMATIONS_TRON || "20",
  PAYMENT_CONFIRMATIONS_BASE: existing.PAYMENT_CONFIRMATIONS_BASE || "12",
};
if (!existing.ADMIN_PASSWORD_SHA256) {
  const temporaryPassword = randomBytes(18).toString("base64url");
  updates.ADMIN_PASSWORD_SHA256 = createHash("sha256").update(temporaryPassword).digest("hex");
  await mkdir(runtimeDir, { recursive: true });
  await writeFile(resolve(runtimeDir, "local-admin-password.txt"), `${temporaryPassword}\n`, { mode: 0o600 });
}
await writeFile(envPath, mergeEnv(existingText, updates), { mode: 0o600 });
await chmod(envPath, 0o600);

const childEnv = { ...process.env, ...existing, ...updates };
if (!commandExists("docker", ["compose", "version"])) throw new Error("Docker Desktop with Docker Compose is required and was not detected");
run("corepack", ["pnpm", "install", "--frozen-lockfile", "--ignore-scripts"], childEnv);
let composeWaitSucceeded = true;
try { run("docker", ["compose", "up", "-d", "--wait", "postgres", "redis"], childEnv); }
catch { composeWaitSucceeded = false; run("docker", ["compose", "up", "-d", "postgres", "redis"], childEnv); }
if (!composeWaitSucceeded) await new Promise(resolveDelay => setTimeout(resolveDelay, 8_000));
run("corepack", ["pnpm", "db:migrate"], childEnv);
run("corepack", ["pnpm", "db:seed"], childEnv);

await mkdir(logDir, { recursive: true });
await stopPreviousBot();
const log = await open(logPath, fsConstants.O_CREAT | fsConstants.O_APPEND | fsConstants.O_WRONLY, 0o600);
const bot = spawn("corepack", ["pnpm", "dev:bot"], {
  cwd: root,
  env: childEnv,
  detached: true,
  stdio: ["ignore", log.fd, log.fd],
});
bot.unref();
if (!bot.pid) throw new Error("Bot process did not start");
await writeFile(pidPath, `${bot.pid}\n`, { mode: 0o600 });
await new Promise(resolveDelay => setTimeout(resolveDelay, 4_000));
try { process.kill(bot.pid, 0); } catch { throw new Error(`Bot process exited. Inspect ${logPath}`); }
await telegram(token, "sendMessage", { chat_id: adminChatId, text: "Jawad Dev Desk local bot is online. Send /start to run the live intake test." });

console.log("\nTelegram bootstrap PASS");
console.log(`Verified bot: @${username}`);
console.log("Admin chat paired: yes");
console.log(`Bot PID: ${bot.pid}`);
console.log(`Log: ${logPath}`);
console.log("The Mini App menu remains on commands until a verified HTTPS deployment URL is configured.");
