import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { qualify } from "../../../packages/qualification/src/index.ts";
import { PaymentLedger } from "../../../packages/payments/src/index.ts";
import { parseAttribution, transition, type Intake } from "../../../packages/domain/src/index.ts";
import { scoreDemandSignal, SlidingWindowRateLimiter } from "../../../packages/telegram/src/index.ts";
import { leads } from "./store.ts";

const ledger = new PaymentLedger();
const limiter = new SlidingWindowRateLimiter(60, 60_000);
const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "../public");

async function parseBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += value.length;
    if (size > 1_000_000) throw new Error("BODY_TOO_LARGE");
    chunks.push(value);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("INVALID_JSON"); }
}
function send(res: ServerResponse, status: number, data: unknown, type = "application/json") {
  const payload = type.includes("json") ? JSON.stringify(data, (_k, value) => typeof value === "bigint" ? value.toString() : value) : String(data);
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; frame-ancestors 'self' https://web.telegram.org",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=()"
  });
  res.end(payload);
}
function allowRequest(req: IncomingMessage) {
  const key = req.socket.remoteAddress ?? "unknown";
  return limiter.allow(key);
}
function isSafePost(req: IncomingMessage) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  return origin === `http://${host}` || origin === `https://${host}`;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!allowRequest(req).allowed) return send(res, 429, { error: "RATE_LIMITED" });
    if (req.method === "POST" && !isSafePost(req)) return send(res, 403, { error: "ORIGIN_REJECTED" });

    if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, service: "jawad-engine-demo" });
    if (req.method === "GET" && url.pathname === "/api/leads") return send(res, 200, [...leads.values()]);
    if (req.method === "GET" && url.pathname === "/api/stats") {
      const statuses = Object.fromEntries([...leads.values()].reduce((map, lead) => map.set(lead.status, (map.get(lead.status) ?? 0) + 1), new Map<string, number>()));
      return send(res, 200, { total: leads.size, statuses, capacity: { quickFixSlots: 2, rescueSlots: 1, checkoutPaused: false, awayMode: false } });
    }
    if (req.method === "POST" && url.pathname === "/api/intake") {
      const intake = await parseBody(req) as Intake;
      if (!intake.id || !intake.name || !intake.kind) return send(res, 422, { error: "INVALID_INTAKE" });
      const qualification = qualify(intake);
      const id = randomUUID();
      const attribution = parseAttribution(intake.referralSlug ? `partner_${intake.referralSlug}` : "direct");
      leads.set(id, {
        id, intake, qualification,
        status: qualification.recommendedPackage === "REJECT" ? "REJECTED" : qualification.missingInformation.length ? "AWAITING_INFORMATION" : "AWAITING_REVIEW",
        createdAt: new Date().toISOString(),
        ...(attribution.partnerSlug ? { referral: { partnerSlug: attribution.partnerSlug, commissionPercent: 20, eligible: false } } : {})
      });
      return send(res, 201, leads.get(id));
    }
    if (req.method === "POST" && url.pathname === "/api/group-signal") {
      const input = await parseBody(req) as { text?: string; authorised?: boolean };
      if (!input.authorised) return send(res, 403, { error: "GROUP_ADMIN_AUTHORISATION_REQUIRED" });
      if (!input.text?.trim()) return send(res, 422, { error: "TEXT_REQUIRED" });
      return send(res, 200, { ...scoreDemandSignal(input.text), responseMode: "NOTIFY_JAWAD_ONLY", automaticDm: false });
    }

    const quoteMatch = url.pathname.match(/^\/api\/leads\/([^/]+)\/quote$/);
    if (req.method === "POST" && quoteMatch) {
      const lead = leads.get(quoteMatch[1]!);
      if (!lead) return send(res, 404, { error: "NOT_FOUND" });
      if (lead.status !== "AWAITING_REVIEW") return send(res, 409, { error: "WRONG_STATUS", status: lead.status });
      const input = await parseBody(req) as { price?: number; network?: "TRON_TRC20"|"BASE_USDC" };
      const price = Number(input.price);
      if (!Number.isFinite(price) || price < 100) return send(res, 422, { error: "INVALID_PRICE" });
      const network = input.network === "TRON_TRC20" ? "TRON_TRC20" : "BASE_USDC";
      lead.quote = { price, network, approved: true };
      lead.status = transition(transition(lead.status, "QUOTE_SENT"), "AWAITING_PAYMENT");
      return send(res, 200, lead);
    }

    const invoiceMatch = url.pathname.match(/^\/api\/leads\/([^/]+)\/invoice$/);
    if (req.method === "POST" && invoiceMatch) {
      const lead = leads.get(invoiceMatch[1]!);
      if (!lead?.quote || lead.status !== "AWAITING_PAYMENT") return send(res, 409, { error: "APPROVED_QUOTE_REQUIRED" });
      const input = await parseBody(req) as { network:"TRON_TRC20"|"BASE_USDC"; recipient:string; tokenContract:string };
      if (!input.recipient || !input.tokenContract || input.network !== lead.quote.network) return send(res, 422, { error: "INVALID_INVOICE_CONFIG" });
      const invoice = ledger.create({
        network: input.network, token: input.network === "TRON_TRC20" ? "USDT" : "USDC", recipient: input.recipient,
        tokenContract: input.tokenContract, amountMinor: BigInt(Math.round(lead.quote.price * 1_000_000)), decimals: 6,
        createdAt: Date.now(), expiresAt: Date.now() + 3_600_000
      });
      lead.invoiceId = invoice.id;
      return send(res, 201, invoice);
    }

    const verifyMatch = url.pathname.match(/^\/api\/invoices\/([^/]+)\/verify$/);
    if (req.method === "POST" && verifyMatch) {
      const input = await parseBody(req) as Record<string, unknown> & { amountMinor: string; minConfirmations?: number };
      const evidence = ledger.verifyAndAssign(verifyMatch[1]!, { ...(input as any), amountMinor: BigInt(input.amountMinor) }, Number(input.minConfirmations ?? 1));
      if (evidence.ok) {
        const lead = [...leads.values()].find(value => value.invoiceId === verifyMatch[1]);
        if (lead && lead.status === "AWAITING_PAYMENT") {
          lead.status = transition(lead.status, "PAID");
          lead.paymentEvidence = { txHash: evidence.transfer?.txHash ?? "unknown", code: evidence.code };
        }
      }
      return send(res, evidence.ok ? 200 : 422, evidence);
    }

    const demoPaymentMatch = url.pathname.match(/^\/api\/leads\/([^/]+)\/demo-payment$/);
    if (req.method === "POST" && demoPaymentMatch) {
      const lead = leads.get(demoPaymentMatch[1]!);
      if (!lead?.quote || lead.status !== "AWAITING_PAYMENT") return send(res, 409, { error: "AWAITING_PAYMENT_REQUIRED" });
      const network = lead.quote.network;
      const recipient = network === "TRON_TRC20" ? "T_DEMO_RECEIVER_NOT_REAL" : "0x000000000000000000000000000000000000dEaD";
      const tokenContract = network === "TRON_TRC20" ? "T_DEMO_USDT_NOT_REAL" : "0x0000000000000000000000000000000000000001";
      const now = Date.now();
      const invoice = ledger.create({ network, token: network === "TRON_TRC20" ? "USDT" : "USDC", recipient, tokenContract, amountMinor: BigInt(Math.round(lead.quote.price * 1_000_000)), decimals: 6, createdAt: now, expiresAt: now + 3_600_000 });
      lead.invoiceId = invoice.id;
      const txHash = `demo_${randomUUID()}`;
      const evidence = ledger.verifyAndAssign(invoice.id, { txHash, network, success: true, tokenContract, from: "DEMO_CLIENT", to: recipient, amountMinor: invoice.amountMinor, confirmations: 20, timestamp: now }, 12, now);
      if (!evidence.ok) return send(res, 500, { error: "DEMO_PAYMENT_FAILED", evidence });
      lead.status = transition(lead.status, "PAID");
      lead.paymentEvidence = { txHash, code: evidence.code };
      return send(res, 200, lead);
    }

    const actionMatch = url.pathname.match(/^\/api\/leads\/([^/]+)\/action$/);
    if (req.method === "POST" && actionMatch) {
      const lead = leads.get(actionMatch[1]!);
      if (!lead) return send(res, 404, { error: "NOT_FOUND" });
      const input = await parseBody(req) as { action?: string; deliveryMessage?: string };
      if (input.action === "start") lead.status = transition(lead.status, "IN_PROGRESS");
      else if (input.action === "deliver") { lead.status = transition(lead.status, "AWAITING_CLIENT_ACCEPTANCE"); lead.deliveryMessage = input.deliveryMessage?.trim() || "Repair delivered with test evidence."; }
      else if (input.action === "accept") { lead.status = transition(lead.status, "COMPLETED"); lead.testimonialRequested = true; if (lead.referral) lead.referral.eligible = true; }
      else return send(res, 422, { error: "UNKNOWN_ACTION" });
      return send(res, 200, lead);
    }

    const deleteMatch = url.pathname.match(/^\/api\/leads\/([^/]+)$/);
    if (req.method === "DELETE" && deleteMatch) {
      const existed = leads.delete(deleteMatch[1]!);
      return send(res, existed ? 200 : 404, { deleted: existed });
    }

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/admin" || url.pathname.startsWith("/mini-app"))) return send(res, 200, await readFile(join(publicDir, "index.html"), "utf8"), "text/html; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/app.js") return send(res, 200, await readFile(join(publicDir, "app.js"), "utf8"), "text/javascript; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/styles.css") return send(res, 200, await readFile(join(publicDir, "styles.css"), "utf8"), "text/css; charset=utf-8");
    return send(res, 404, { error: "NOT_FOUND" });
  } catch (error) {
    if (res.headersSent) return res.end();
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "INVALID_JSON" ? 400 : message === "BODY_TOO_LARGE" ? 413 : message.startsWith("Illegal job transition") ? 409 : 500;
    return send(res, status, { error: status === 500 ? "INTERNAL_ERROR" : message });
  }
});

const port = Number(process.env.PORT ?? 3100);
if (process.env.NODE_ENV !== "test") server.listen(port, () => console.log(JSON.stringify({ level: "info", service: "demo", url: `http://localhost:${port}` })));
export { server };
