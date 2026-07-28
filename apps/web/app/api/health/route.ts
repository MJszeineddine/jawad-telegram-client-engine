import { NextResponse } from "next/server";
import { isDemoMode } from "@jawad/config";
import { createPostgresRepository } from "@jawad/database";
import { rateLimitStoreReady } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

export async function GET() {
  const time = new Date().toISOString();
  if (isDemoMode()) {
    return NextResponse.json(
      { ok: true, ready: true, service: "jawad-telegram-client-engine", mode: "demo", time },
      { headers: noStore },
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  const encryptionKey = process.env.DATA_ENCRYPTION_KEY;
  const missing = [
    ["DATABASE_URL", databaseUrl],
    ["REDIS_URL", process.env.REDIS_URL],
    ["TRUSTED_PROXY_HEADER", process.env.TRUSTED_PROXY_HEADER],
    ["DATA_ENCRYPTION_KEY", encryptionKey],
    ["ADMIN_SESSION_SECRET", process.env.ADMIN_SESSION_SECRET],
    ["ADMIN_PASSWORD_SHA256", process.env.ADMIN_PASSWORD_SHA256],
    ["TELEGRAM_BOT_TOKEN", process.env.TELEGRAM_BOT_TOKEN],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length) {
    return NextResponse.json(
      { ok: false, ready: false, service: "jawad-telegram-client-engine", mode: "production", reason: "CONFIGURATION_INCOMPLETE", missing, time },
      { status: 503, headers: noStore },
    );
  }

  let repository: Awaited<ReturnType<typeof createPostgresRepository>> | undefined;
  try {
    repository = await createPostgresRepository(databaseUrl!, encryptionKey!);
    const [databaseReady, redisReady] = await Promise.all([
      repository.ping().then(() => true, () => false),
      rateLimitStoreReady(),
    ]);
    if (!databaseReady || !redisReady) {
      return NextResponse.json(
        {
          ok: false,
          ready: false,
          service: "jawad-telegram-client-engine",
          mode: "production",
          reason: "DEPENDENCY_UNAVAILABLE",
          dependencies: { database: databaseReady, redis: redisReady },
          time,
        },
        { status: 503, headers: noStore },
      );
    }
    return NextResponse.json(
      { ok: true, ready: true, service: "jawad-telegram-client-engine", mode: "production", dependencies: { database: true, redis: true }, time },
      { headers: noStore },
    );
  } catch {
    return NextResponse.json(
      { ok: false, ready: false, service: "jawad-telegram-client-engine", mode: "production", reason: "DEPENDENCY_INITIALISATION_FAILED", time },
      { status: 503, headers: noStore },
    );
  } finally {
    await repository?.close().catch(() => undefined);
  }
}
