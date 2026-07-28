import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export type AdminRole = "owner" | "reviewer";
export interface AdminSession {
  subject: string;
  role: AdminRole;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

function encode(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}
function sign(payload: string, secret: string): string {
  return encode(createHmac("sha256", secret).update(payload).digest());
}
function equalText(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function validSecret(secret: string): void {
  if (secret.length < 32) throw new Error("SESSION_SECRET_TOO_SHORT");
}

export function createAdminSession(
  input: { subject: string; role?: AdminRole; ttlMs?: number },
  secret: string,
  now = Date.now(),
): string {
  validSecret(secret);
  const session: AdminSession = {
    subject: input.subject,
    role: input.role ?? "owner",
    issuedAt: now,
    expiresAt: now + (input.ttlMs ?? 8 * 60 * 60_000),
    nonce: randomBytes(18).toString("base64url"),
  };
  const payload = encode(JSON.stringify(session));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyAdminSession(token: string | undefined, secret: string, now = Date.now()): AdminSession | null {
  if (!token || secret.length < 32) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || !equalText(signature, sign(payload, secret))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<AdminSession>;
    if (!parsed.subject || !parsed.nonce || (parsed.role !== "owner" && parsed.role !== "reviewer")) return null;
    if (!Number.isFinite(parsed.issuedAt) || !Number.isFinite(parsed.expiresAt) || Number(parsed.expiresAt) <= now) return null;
    if (Number(parsed.issuedAt) > now + 60_000) return null;
    return parsed as AdminSession;
  } catch {
    return null;
  }
}

export function createCsrfToken(sessionToken: string, secret: string): string {
  validSecret(secret);
  const nonce = randomBytes(18).toString("base64url");
  return `${nonce}.${sign(`${sessionToken}.${nonce}`, secret)}`;
}

export function verifyCsrfToken(sessionToken: string, token: string | undefined, secret: string): boolean {
  if (!token || secret.length < 32) return false;
  const [nonce, signature, extra] = token.split(".");
  if (!nonce || !signature || extra) return false;
  return equalText(signature, sign(`${sessionToken}.${nonce}`, secret));
}

export function sameOrigin(requestUrl: string, origin: string | null): boolean {
  if (!origin) return false;
  try { return new URL(requestUrl).origin === new URL(origin).origin; }
  catch { return false; }
}

function privateIpv4(host: string): boolean {
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = octets as [number, number, number, number];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function isSafePublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
    const ipVersion = isIP(host);
    if (ipVersion === 4 && privateIpv4(host)) return false;
    if (ipVersion === 6 && (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb"))) return false;
    return true;
  } catch {
    return false;
  }
}

const secretKey = /(token|secret|password|private[_-]?key|seed|authorization|cookie)/i;
export function redactStructuredLog(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [
    key,
    secretKey.test(key) ? "[REDACTED]" : typeof value === "object" && value && !Array.isArray(value) ? redactStructuredLog(value as Record<string, unknown>) : value,
  ]));
}


export interface EncryptedEnvelope {
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
}

function encryptionKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new Error("DATA_ENCRYPTION_KEY_MUST_BE_32_BYTES_BASE64");
  return key;
}

export function encryptJson(value: unknown, base64Key: string): EncryptedEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(base64Key), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { version: 1, algorithm: "aes-256-gcm", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}

export function decryptJson<T>(envelope: EncryptedEnvelope, base64Key: string): T {
  if (envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm") throw new Error("UNSUPPORTED_ENCRYPTION_ENVELOPE");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(base64Key), Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
