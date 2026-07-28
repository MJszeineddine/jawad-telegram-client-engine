import { createHash } from "node:crypto";
import { isDemoMode } from "@jawad/config";
import { SlidingWindowRateLimiter } from "@jawad/telegram";

type RateScope = "intake" | "attachment" | "payment" | "admin-login" | "privacy-delete" | "testimonial" | "client-message" | "job-accept";
type RateDecision = { allowed: boolean; retryAfterMs: number };
type RatePolicy = { limit: number; windowMs: number };

const policies: Record<RateScope, RatePolicy> = {
  intake: { limit: 8, windowMs: 60_000 },
  attachment: { limit: 12, windowMs: 60_000 },
  payment: { limit: 8, windowMs: 60_000 },
  "admin-login": { limit: 8, windowMs: 15 * 60_000 },
  "privacy-delete": { limit: 3, windowMs: 60 * 60_000 },
  testimonial: { limit: 5, windowMs: 60 * 60_000 },
  "client-message": { limit: 20, windowMs: 60 * 60_000 },
  "job-accept": { limit: 5, windowMs: 60 * 60_000 },
};

const globalState = globalThis as typeof globalThis & {
  __jawadRateLimiters?: Record<RateScope, SlidingWindowRateLimiter>;
  __jawadRateLimitRedis?: Promise<any>;
};

const memoryLimiters = globalState.__jawadRateLimiters ?? Object.fromEntries(
  Object.entries(policies).map(([scope, policy]) => [scope, new SlidingWindowRateLimiter(policy.limit, policy.windowMs)]),
) as Record<RateScope, SlidingWindowRateLimiter>;
globalState.__jawadRateLimiters = memoryLimiters;

function safeKey(scope: RateScope, key: string): string {
  const digest = createHash("sha256").update(`${scope}:${key}`).digest("hex");
  return `jawad:rate-limit:${scope}:${digest}`;
}

async function redisClient(): Promise<any> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || !/^rediss?:\/\//.test(redisUrl)) throw new Error("RATE_LIMIT_REDIS_NOT_CONFIGURED");
  if (!globalState.__jawadRateLimitRedis) {
    globalState.__jawadRateLimitRedis = import("ioredis").then((module: any) => {
      const Redis = module.default ?? module;
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        connectTimeout: 3_000,
        commandTimeout: 3_000,
        lazyConnect: false,
      });
      client.on("error", () => undefined);
      return client;
    });
  }
  return globalState.__jawadRateLimitRedis;
}

const atomicWindowScript = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`;

export async function allowRequest(scope: RateScope, key: string): Promise<RateDecision> {
  const policy = policies[scope];
  if (isDemoMode()) return memoryLimiters[scope].allow(`${scope}:${key}`);
  try {
    const redis = await redisClient();
    const result = await redis.call("EVAL", atomicWindowScript, 1, safeKey(scope, key), policy.windowMs) as [number | string, number | string];
    const count = Number(result[0]);
    const ttl = Math.max(1, Number(result[1]));
    return { allowed: count <= policy.limit, retryAfterMs: count <= policy.limit ? 0 : ttl };
  } catch {
    // Production rate limiting fails closed if Redis is unavailable.
    return { allowed: false, retryAfterMs: 5_000 };
  }
}

export async function rateLimitStoreReady(): Promise<boolean> {
  if (isDemoMode()) return true;
  try {
    const redis = await redisClient();
    return (await redis.ping()) === "PONG";
  } catch {
    return false;
  }
}

const supportedProxyHeaders = new Set(["x-real-ip", "cf-connecting-ip", "fly-client-ip", "true-client-ip"]);

export function requestAddress(request: Request): string {
  if (isDemoMode()) {
    return (request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "demo-client").trim().slice(0, 100);
  }
  const configured = (process.env.TRUSTED_PROXY_HEADER ?? "").trim().toLowerCase();
  if (!supportedProxyHeaders.has(configured)) return "unresolved-client";
  const value = request.headers.get(configured)?.split(",")[0]?.trim();
  return value && value.length <= 100 ? value : "unresolved-client";
}
