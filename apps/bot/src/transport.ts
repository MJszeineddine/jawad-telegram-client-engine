import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export const TELEGRAM_ALLOWED_UPDATES = ["message", "callback_query"] as const;
export type TelegramUpdateMode = "long_polling" | "webhook";

export function parseTelegramUpdateMode(value: string | undefined): TelegramUpdateMode {
  const mode = (value ?? "").trim();
  if (mode === "long_polling" || mode === "webhook") return mode;
  throw new Error("TELEGRAM_UPDATE_MODE must be exactly long_polling or webhook");
}

export function parseRuntimePort(value: string | undefined, name: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return port;
}

export interface TelegramRuntimeBot {
  api: {
    deleteWebhook(options: { drop_pending_updates: boolean }): Promise<unknown>;
  };
  start(options: {
    allowed_updates: string[];
    onStart?: (botInfo: unknown) => void;
  }): Promise<void>;
  stop(): void | Promise<void>;
  handleUpdate(update: unknown): Promise<unknown>;
}

export interface BotTransportOptions {
  mode: TelegramUpdateMode;
  /** Use 0 only in tests to request an ephemeral operating-system port. */
  port: number;
  webhookSecret?: string;
  startupTimeoutMs?: number;
  log?: (entry: Record<string, unknown>) => void;
}

export interface BotTransportHandle {
  readonly mode: TelegramUpdateMode;
  readonly port: number;
  readonly completion: Promise<void>;
  stop(reason?: string): Promise<void>;
}

interface RuntimeState {
  ready: boolean;
  mode: TelegramUpdateMode;
  startedAt?: string;
  lastError?: string;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function responseJson(response: ServerResponse, status: number, body: Record<string, unknown>): void {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function healthPayload(state: RuntimeState): Record<string, unknown> {
  return {
    ok: state.ready,
    ready: state.ready,
    service: "telegram-bot",
    mode: state.mode,
    ...(state.startedAt ? { startedAt: state.startedAt } : {}),
    ...(state.lastError ? { error: state.lastError } : {}),
  };
}

function listen(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("BOT_TRANSPORT_LISTEN_ADDRESS_UNAVAILABLE"));
        return;
      }
      resolve(address.port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    // Docker publishes this container port only on 127.0.0.1. Binding inside the
    // container to all interfaces keeps the health endpoint reachable by Docker.
    server.listen(port, "0.0.0.0");
  });
}

function closeServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

async function readBoundedRequest(request: IncomingMessage, maximumBytes = 1_000_000): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.length;
    if (total > maximumBytes) throw new Error("WEBHOOK_BODY_TOO_LARGE");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, total);
}

function timeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    timer.unref();
  });
}

export async function startBotTransport(
  bot: TelegramRuntimeBot,
  options: BotTransportOptions,
): Promise<BotTransportHandle> {
  const log = options.log ?? (entry => console.log(JSON.stringify(entry)));
  const state: RuntimeState = { ready: false, mode: options.mode };
  let stopping = false;

  if (options.mode === "long_polling") {
    const server = createServer((request, response) => {
      if (request.method === "GET" && request.url === "/health") {
        responseJson(response, state.ready ? 200 : 503, healthPayload(state));
        return;
      }
      response.writeHead(404).end();
    });
    const boundPort = await listen(server, options.port);

    try {
      await bot.api.deleteWebhook({ drop_pending_updates: false });
    } catch (error) {
      state.lastError = "TELEGRAM_DELETE_WEBHOOK_FAILED";
      await closeServer(server).catch(() => undefined);
      throw error;
    }

    let resolveStarted!: () => void;
    let rejectStarted!: (error: unknown) => void;
    const started = new Promise<void>((resolve, reject) => {
      resolveStarted = resolve;
      rejectStarted = reject;
    });

    let polling: Promise<void>;
    try {
      polling = bot.start({
        allowed_updates: [...TELEGRAM_ALLOWED_UPDATES],
        onStart: () => {
          state.ready = true;
          state.startedAt = new Date().toISOString();
          log({ level: "info", service: "bot", mode: "long_polling", port: boundPort, ready: true });
          resolveStarted();
        },
      });
    } catch (error) {
      state.lastError = "TELEGRAM_LONG_POLLING_START_FAILED";
      await closeServer(server).catch(() => undefined);
      throw error;
    }

    void polling.catch(error => {
      state.ready = false;
      state.lastError = "TELEGRAM_LONG_POLLING_FAILED";
      log({ level: "error", service: "bot", mode: "long_polling", event: "runtime-failed", error: state.lastError });
      rejectStarted(error);
    });

    try {
      await Promise.race([
        started,
        polling.then(() => Promise.reject(new Error("TELEGRAM_LONG_POLLING_STOPPED_BEFORE_START"))),
        timeout(options.startupTimeoutMs ?? 30_000, "TELEGRAM_LONG_POLLING_START_TIMEOUT"),
      ]);
    } catch (error) {
      state.ready = false;
      await Promise.resolve(bot.stop()).catch(() => undefined);
      await closeServer(server).catch(() => undefined);
      throw error;
    }

    const completion = polling.finally(async () => {
      state.ready = false;
      await closeServer(server).catch(() => undefined);
    });

    return {
      mode: options.mode,
      port: boundPort,
      completion,
      async stop(reason = "shutdown") {
        if (stopping) return;
        stopping = true;
        state.ready = false;
        log({ level: "info", service: "bot", mode: "long_polling", event: "shutdown", reason });
        await Promise.resolve(bot.stop());
        await completion.catch(() => undefined);
      },
    };
  }

  const webhookSecret = options.webhookSecret?.trim();
  if (!webhookSecret) throw new Error("TELEGRAM_WEBHOOK_SECRET is required in webhook mode");

  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      responseJson(response, state.ready ? 200 : 503, healthPayload(state));
      return;
    }
    if (request.method !== "POST") {
      response.writeHead(405).end();
      return;
    }
    const provided = String(request.headers["x-telegram-bot-api-secret-token"] ?? "");
    if (!safeEqual(provided, webhookSecret)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readBoundedRequest(request);
      await bot.handleUpdate(JSON.parse(body.toString("utf8")));
      response.writeHead(200).end();
    } catch (error) {
      if (error instanceof Error && error.message === "WEBHOOK_BODY_TOO_LARGE") {
        response.writeHead(413).end();
        return;
      }
      response.writeHead(500).end();
    }
  });

  const boundPort = await listen(server, options.port);
  state.ready = true;
  state.startedAt = new Date().toISOString();
  log({ level: "info", service: "bot", mode: "webhook", port: boundPort, ready: true });

  let resolveCompletion!: () => void;
  let rejectCompletion!: (error: unknown) => void;
  const completion = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });
  server.once("close", resolveCompletion);
  server.once("error", error => {
    state.ready = false;
    state.lastError = "TELEGRAM_WEBHOOK_SERVER_FAILED";
    log({ level: "error", service: "bot", mode: "webhook", event: "runtime-failed", error: state.lastError });
    rejectCompletion(error);
  });

  return {
    mode: options.mode,
    port: boundPort,
    completion,
    async stop(reason = "shutdown") {
      if (stopping) return;
      stopping = true;
      state.ready = false;
      log({ level: "info", service: "bot", mode: "webhook", event: "shutdown", reason });
      await closeServer(server);
    },
  };
}
