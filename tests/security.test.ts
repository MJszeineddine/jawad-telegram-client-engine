import test from "node:test";
import assert from "node:assert/strict";
import { createAdminSession, verifyAdminSession, createCsrfToken, verifyCsrfToken, isSafePublicHttpsUrl, redactStructuredLog, sameOrigin, encryptJson, decryptJson } from "../packages/security/src/index.ts";

const secret = "a-secure-test-secret-that-is-longer-than-32-characters";

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
