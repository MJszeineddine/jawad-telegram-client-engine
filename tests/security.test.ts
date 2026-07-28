import test from "node:test";
import assert from "node:assert/strict";
import { createAdminSession, verifyAdminSession, createCsrfToken, verifyCsrfToken, isSafePublicHttpsUrl, redactStructuredLog, sameOrigin, encryptJson, decryptJson } from "../packages/security/src/index.ts";
import { publicPaymentEvidence } from "../packages/database/src/index.ts";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { scanSecrets, candidateFiles } from "../scripts/secret-scan.ts";

const secret = "a-secure-test-secret-that-is-longer-than-32-characters";
const execFileAsync = promisify(execFile);

test("admin sessions are signed, role-bound, and expire", () => {
  const token = createAdminSession({ subject: "jawad", role: "owner", ttlMs: 1_000 }, secret, 10_000);
  assert.equal(verifyAdminSession(token, secret, 10_500)?.subject, "jawad");
  assert.equal(verifyAdminSession(`${token}x`, secret, 10_500), null);
  assert.equal(verifyAdminSession(token, secret, 11_001), null);
});

test("CSRF token is bound to the admin session", () => {
  const session = createAdminSession({ subject: "jawad" }, secret);
  const other = createAdminSession({ subject: "reviewer", role: "reviewer" }, secret);
  const csrf = createCsrfToken(session, secret);
  assert.equal(verifyCsrfToken(session, csrf, secret), true);
  assert.equal(verifyCsrfToken(other, csrf, secret), false);
});

test("URL and origin rules fail closed", () => {
  assert.equal(isSafePublicHttpsUrl("https://example.com/ticket/1"), true);
  assert.equal(isSafePublicHttpsUrl("http://example.com"), false);
  assert.equal(isSafePublicHttpsUrl("https://127.0.0.1/admin"), false);
  assert.equal(isSafePublicHttpsUrl("https://192.168.1.4"), false);
  assert.equal(sameOrigin("https://desk.example/api", "https://desk.example"), true);
  assert.equal(sameOrigin("https://desk.example/api", "https://evil.example"), false);
});

test("structured logs redact secret-shaped fields", () => {
  assert.deepEqual(redactStructuredLog({ event: "login", token: "abc", nested: { password: "p", safe: 1 } }), { event: "login", token: "[REDACTED]", nested: { password: "[REDACTED]", safe: 1 } });
});


test("sensitive intake JSON uses authenticated encryption", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const envelope = encryptJson({ privateProject: "confidential", error: "safe" }, key);
  assert.notEqual(envelope.ciphertext.includes("confidential"), true);
  assert.deepEqual(decryptJson(envelope, key), { privateProject: "confidential", error: "safe" });
  assert.throws(() => decryptJson({ ...envelope, tag: Buffer.alloc(16).toString("base64") }, key));
});


test("client payment evidence strips internal override metadata", () => {
  assert.deepEqual(publicPaymentEvidence({
    txHash: "0xabc",
    network: "BASE_USDC",
    confirmations: 12,
    manualOverride: true,
    recordedAt: "2026-07-28T00:00:00.000Z",
    actor: "owner@example",
    reasonEncrypted: { algorithm: "aes-256-gcm", ciphertext: "secret" },
    providerDebug: "internal",
  }), {
    txHash: "0xabc",
    network: "BASE_USDC",
    confirmations: 12,
    manualOverride: true,
    recordedAt: "2026-07-28T00:00:00.000Z",
  });
});


test("secret scan follows Git tracking and ignore boundaries", async () => {
  const root = await mkdtemp(join(tmpdir(), "jawad-secret-scan-"));
  try {
    await execFileAsync("git", ["init"], { cwd: root });
    await writeFile(join(root, ".gitignore"), ".env\n.env.*\n!.env.example\nruntime/\n");
    await writeFile(join(root, ".env"), `TELEGRAM_BOT_TOKEN=123456:${"a".repeat(35)}\n`);
    await writeFile(join(root, ".env.example"), "TELEGRAM_BOT_TOKEN=\n");
    await mkdir(join(root, "runtime"));
    await writeFile(join(root, "runtime", "debug.log"), `api_key=${"b".repeat(64)}\n`);
    await mkdir(join(root, "src"));
    const tokenPrefix = "987654";
    await writeFile(join(root, "src", "tracked.ts"), `export const accidental = "${tokenPrefix}:${"c".repeat(35)}";\n`);
    await execFileAsync("git", ["add", ".gitignore", ".env.example", "src/tracked.ts"], { cwd: root });

    assert.deepEqual((await candidateFiles(root)).sort(), [".env.example", ".gitignore", "src/tracked.ts"]);
    assert.deepEqual(await scanSecrets(root), [{ file: "src/tracked.ts", kind: "Telegram token" }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("secret scan detects credential material in scanned files", async () => {
  const root = await mkdtemp(join(tmpdir(), "jawad-secret-patterns-"));
  try {
    await execFileAsync("git", ["init"], { cwd: root });
    const recoveryPhrase = "recovery" + " phrase";
    await writeFile(join(root, "secrets.txt"), [
      "-----BEGIN " + "PRIVATE KEY-----",
      `service_secret=${"d".repeat(64)}`,
      `${recoveryPhrase}: correct horse battery staple`,
    ].join("\n"));
    await execFileAsync("git", ["add", "secrets.txt"], { cwd: root });

    assert.deepEqual(await scanSecrets(root), [
      { file: "secrets.txt", kind: "private key" },
      { file: "secrets.txt", kind: "credential-shaped 64-char hex value" },
      { file: "secrets.txt", kind: "seed phrase" },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
