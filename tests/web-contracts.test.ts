import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("..",import.meta.url);
async function source(path:string){return readFile(new URL(path,root),"utf8")}

test("Mini App client-message payload matches the API contract",async()=>{
  const mini=await source("apps/web/components/MiniAppShell.tsx");
  const route=await source("apps/web/app/api/tickets/[id]/messages/route.ts");
  assert.match(mini,/JSON\.stringify\(\{body:message\}\)/);
  assert.match(route,/body\.body/);
});

test("delivery acceptance and proof downloads remain Telegram-bound",async()=>{
  const mini=await source("apps/web/components/MiniAppShell.tsx");
  const accept=await source("apps/web/app/api/jobs/[id]/accept/route.ts");
  const download=await source("apps/web/app/api/client/attachments/[id]/route.ts");
  assert.match(mini,/data\.ticketId/);
  assert.match(accept,/telegramClient\(request\)/);
  assert.match(download,/getAttachmentForClient/);
  assert.match(download,/cache-control":"private, no-store/);
});

test("client ticket includes private conversation and job proof attachments",async()=>{
  const miniSource=await source("apps/web/components/MiniAppShell.tsx");
  const database=await source("packages/database/src/index.ts");
  assert.match(database,/conversation:ConversationDetail\[\]/);
  assert.match(database,/SELECT id,direction,body,created_at FROM conversations/);
  assert.match(database,/SELECT \* FROM attachments WHERE job_id=/);
  assert.match(miniSource, /item\.body/);
});

test("database payment assignment verifies the winning concurrent insert",async()=>{
  const database=await source("packages/database/src/index.ts");
  assert.match(database,/ON CONFLICT\(tx_hash\) DO NOTHING RETURNING invoice_id/);
  assert.match(database,/if\(!assigned\[0\]\)/);
  assert.match(database,/reference_usd_minor=COALESCE/);
});

test("Telegram Mini App SDK is loaded before interactive code",async()=>{
  const layout=await source("apps/web/app/layout.tsx");
  assert.match(layout,/telegram-web-app\.js/);
  assert.match(layout,/beforeInteractive/);
});

test("operations controls include category filters, quiet hours, and audited job details",async()=>{
  const settings=await source("apps/web/app/admin/settings/page.tsx");
  const groupRoute=await source("apps/web/app/api/admin/settings/groups/route.ts");
  const jobPage=await source("apps/web/app/admin/jobs/[id]/page.tsx");
  const jobDetails=await source("apps/web/app/api/admin/jobs/[id]/details/route.ts");
  assert.match(settings,/keywordCategories/);
  assert.match(settings,/quietHoursEnabled/);
  assert.match(groupRoute,/allDemandCategoryIds/);
  assert.match(jobPage,/Internal engineering notes/);
  assert.match(jobDetails,/updateJobDetails/);
});

test("quote expiry, invoice QR, and printable receipts are client-bound",async()=>{
  const quotePage=await source("apps/web/app/admin/leads/[id]/page.tsx");
  const quoteRoute=await source("apps/web/app/api/admin/leads/[id]/quote/route.ts");
  const qr=await source("apps/web/app/api/invoices/[id]/qr/route.ts");
  const receipt=await source("apps/web/app/api/invoices/[id]/receipt/route.ts");
  assert.match(quotePage,/expiryHours/);
  assert.match(quoteRoute,/expiryHours\*60\*60_000/);
  assert.match(qr,/telegramClient\(request\)/);
  assert.match(receipt,/telegramClient\(request\)/);
  assert.match(receipt,/buildReceipt/);
});

test("partner administration records starts and manual-only payout state",async()=>{
  const database=await source("packages/database/src/index.ts");
  const bot=await source("apps/bot/src/grammy-adapter.ts");
  const partnerPage=await source("apps/web/app/admin/partners/page.tsx");
  const payout=await source("apps/web/app/api/admin/referrals/[id]/payout/route.ts");
  assert.match(bot,/onStartAttribution/);
  assert.match(database,/recordPartnerStart/);
  assert.match(database,/REFERRAL_NOT_PAYABLE/);
  assert.match(partnerPage,/does not send crypto/);
  assert.match(payout,/updateReferralPayoutStatus/);
});

test("manual payment override is owner-only, acknowledged, audited, and never sends crypto",async()=>{
  const route=await source("apps/web/app/api/admin/invoices/[id]/manual-confirm/route.ts");
  const database=await source("packages/database/src/index.ts");
  assert.match(route,/session\.role!=="owner"/);
  assert.match(route,/acknowledged/);
  assert.match(route,/reason\.length<20/);
  assert.match(database,/payment\.manual_override/);
  assert.match(database,/HUMAN_REVIEWED_OUTSIDE_AUTOMATIC_PROVIDER/);
  assert.doesNotMatch(route,/sendTransaction|eth_sendTransaction|transfer\(/);
});

test("verified privacy completion deletes stored files before identity anonymisation",async()=>{
  const route=await source("apps/web/app/api/admin/privacy/deletions/[id]/complete/route.ts");
  const database=await source("packages/database/src/index.ts");
  assert.match(route,/session\.role!=="owner"/);
  assert.match(route,/IDENTITY_VERIFICATION_ACKNOWLEDGEMENT_REQUIRED/);
  assert.ok(route.indexOf("deleteStorageKey") < route.indexOf("completeDeletionRequest"));
  assert.match(database,/telegram_user_id=NULL/);
  assert.match(database,/\[Deleted by user request\]/);
  assert.match(database,/privacy\.deletion_completed/);
});

test("bot updates and wizard state survive retries without duplicate processing",async()=>{
  const adapter=await source("apps/bot/src/grammy-adapter.ts");
  const store=await source("apps/bot/src/session-store.ts");
  const database=await source("packages/database/src/index.ts");
  assert.match(adapter,/claimUpdate/);
  assert.match(adapter,/completeUpdate/);
  assert.match(adapter,/releaseUpdate/);
  assert.match(store,/createRedisBotWizardStore/);
  assert.match(store,/"EX",ttlSeconds/);
  assert.match(database,/processed_telegram_updates/);
});


test("Mini App framing and external navigation remain Telegram-safe",async()=>{
  const config=await source("apps/web/next.config.ts");
  const mini=await source("apps/web/components/MiniAppShell.tsx");
  assert.match(config,/source:"\/mini-app\/:path\*"/);
  assert.match(config,/frame-ancestors 'self' https:\/\/web\.telegram\.org https:\/\/\*\.telegram\.org/);
  assert.doesNotMatch(config,/source:"\/mini-app\/:path\*"[^]*X-Frame-Options/);
  assert.match(mini,/Telegram\?\.WebApp/);
  assert.match(mini,/openLink/);
  assert.doesNotMatch(mini,/href="https:\/\/mjszeineddine\.github\.io\/"/);
});

test("client ticket payload strips owner-only notes and storage locations",async()=>{
  const database=await source("packages/database/src/index.ts");
  const demoRoute=await source("apps/web/app/api/tickets/[id]/route.ts");
  assert.match(database,/Omit<JobDetail,"internalNotes"\|"attachments">/);
  assert.match(database,/const \{internalNotes:_internalNotes,attachments:_attachments,\.\.\.safe\}=job/);
  assert.match(database,/ClientAttachmentDetail = Omit<AttachmentDetail,"storageKey">/);
  assert.doesNotMatch(demoRoute,/storageKey:/);
});

test("only Telegram-bound client acceptance can complete a paid job",async()=>{
  const database=await source("packages/database/src/index.ts");
  const adminRoute=await source("apps/web/app/api/admin/jobs/[id]/action/route.ts");
  const adminPage=await source("apps/web/app/admin/jobs/[id]/page.tsx");
  assert.doesNotMatch(adminRoute,/\["in_progress","awaiting_client_acceptance","completed","refunded"\]/);
  assert.doesNotMatch(adminPage,/value="completed"/);
  assert.match(database,/acceptJob\(input\)/);
  assert.match(database,/accepted_by_telegram_user_id/);
  assert.match(database,/awaiting_client_acceptance:\["in_progress","refunded"\]/);
  assert.ok(database.indexOf("status='eligible'") < database.indexOf("async submitTestimonial"));
});

test("invoice creation serialises capacity and derives the real lead from the quote",async()=>{
  const database=await source("packages/database/src/index.ts");
  const route=await source("apps/web/app/api/admin/quotes/[id]/invoice/route.ts");
  assert.match(database,/FOR UPDATE OF q,l,c/);
  assert.match(database,/lockedExisting=await tx`SELECT id FROM invoices WHERE quote_id=/);
  assert.match(database,/COALESCE\(recommended_package/);
  assert.match(database,/return\{invoiceId,leadId\}/);
  assert.match(route,/const \{invoiceId,leadId\}=await repo\.createInvoiceForQuote/);
  assert.match(route,/getLeadTelegramTarget\(leadId\)/);
});

test("completed database jobs require recorded acceptance evidence",async()=>{
  const migration=await source("packages/database/migrations/011_acceptance_evidence.sql");
  const migrate=await source("scripts/migrate.ts");
  assert.match(migration,/completed_requires_acceptance/);
  assert.match(migration,/status<>'completed' OR accepted_at IS NOT NULL/);
  assert.match(migrate,/011_acceptance_evidence\.sql/);
});

test("production mode cannot silently fall back to demo identity or credentials",async()=>{
  const config=await source("packages/config/src/index.ts");
  const telegramClient=await source("apps/web/lib/telegram-client.ts");
  const login=await source("apps/web/app/api/admin/login/route.ts");
  const intake=await source("apps/web/app/api/intake/route.ts");
  const validator=await source("scripts/setup-validator.ts");
  assert.match(config,/env\.NODE_ENV!=="production"/);
  assert.match(telegramClient,/process\.env\.NODE_ENV!=="production"/);
  assert.match(login,/process\.env\.NODE_ENV!=="production"/);
  assert.match(intake,/!valid\.ok\|\|!valid\.user\?\.id/);
  assert.match(validator,/DEMO_MODE cannot be enabled when NODE_ENV=production/);
});

test("attachment persistence and Telegram downloads fail closed",async()=>{
  const upload=await source("apps/web/app/api/attachments/route.ts");
  const bot=await source("apps/bot/src/grammy-adapter.ts");
  const worker=await source("apps/worker/src/bullmq-adapter.ts");
  assert.match(upload,/await store\.delete\(record\)/);
  assert.match(upload,/CONTENT_LENGTH_REQUIRED/);
  const adminUpload=await source("apps/web/app/api/admin/jobs/[id]/attachments/route.ts");
  assert.match(adminUpload,/session\.role!=="owner"/);
  assert.match(adminUpload,/CONTENT_LENGTH_REQUIRED/);
  assert.match(bot,/readBoundedBody/);
  assert.match(bot,/AbortSignal\.timeout\(15_000\)/);
  assert.doesNotMatch(bot,/response\.arrayBuffer\(\)/);
  assert.match(worker,/AbortSignal\.timeout\(15_000\)/);
});

test("runtime containers do not require pnpm after the image is built",async()=>{
  const dockerfile=await source("Dockerfile");
  const compose=await source("docker-compose.yml");
  assert.match(dockerfile,/CMD \["node","apps\/web\/node_modules\/next\/dist\/bin\/next"/);
  assert.match(compose,/command: \["node", "--experimental-strip-types", "scripts\/migrate\.ts"\]/);
});

test("sensitive qualification, conversations, notes, and testimonials are encrypted at rest",async()=>{
  const database=await source("packages/database/src/index.ts");
  const migration=await source("packages/database/migrations/012_sensitive_data_and_attribution.sql");
  assert.match(database,/qualificationEnvelope=encryptJson\(input\.qualification/);
  assert.match(database,/encryptedText\(input\.body\.trim\(\),dataEncryptionKey\)/);
  assert.match(database,/internal_notes=\$\{input\.internalNotes\?\.trim\(\)\?encryptedText/);
  assert.match(database,/encryptedText\(input\.response\.slice\(0,4000\),dataEncryptionKey\)/);
  assert.match(migration,/recommended_package/);
  assert.doesNotMatch(database,/qualification->>'recommendedPackage'/);
});

test("partner attribution uses an identity-serialised first touch",async()=>{
  const database=await source("packages/database/src/index.ts");
  const migration=await source("packages/database/migrations/012_sensitive_data_and_attribution.sql");
  assert.match(database,/pg_advisory_xact_lock/);
  assert.match(database,/FROM partner_events pe WHERE pe\.telegram_user_id/);
  assert.match(database,/ORDER BY touched\.created_at,touched\.id LIMIT 1/);
  assert.match(database,/DUPLICATE_ATTRIBUTION_RETAINED_FIRST_TOUCH/);
  assert.match(migration,/partner_events_identity_first_touch_idx/);
});

test("production admin and health surfaces fail closed instead of showing demo records",async()=>{
  const admin=await source("apps/web/lib/admin.ts");
  const health=await source("apps/web/app/api/health/route.ts");
  assert.match(admin,/snapshot: \{ counts: \{\}, leads: \[\] \}/);
  assert.match(admin,/maximumActiveQuickFixes:0/);
  assert.doesNotMatch(admin,/source: "degraded"[^\n]+demoSnapshot\(\)/);
  assert.match(health,/repository\.ping\(\)\.then/);
  assert.match(health,/rateLimitStoreReady/);
  assert.match(health,/REDIS_URL/);
  assert.match(health,/status: 503/);
});


test("production API rate limits are Redis-backed and fail closed",async()=>{
  const limiter=await source("apps/web/lib/rate-limit.ts");
  const webPackage=await source("apps/web/package.json");
  assert.match(limiter,/redis\.call\("EVAL", atomicWindowScript/);
  assert.match(limiter,/createHash\("sha256"\)/);
  assert.match(limiter,/Production rate limiting fails closed/);
  assert.match(limiter,/TRUSTED_PROXY_HEADER/);
  assert.doesNotMatch(limiter,/x-forwarded-for[^\n]+production/i);
  assert.match(webPackage,/"ioredis": "5\.11\.1"/);
});

test("Mini App partner attribution is derived only from authenticated Telegram launch data",async()=>{
  const telegram=await source("packages/telegram/src/index.ts");
  const intake=await source("apps/web/app/api/intake/route.ts");
  assert.match(telegram,/startParam:p\.get\("start_param"\)/);
  assert.match(intake,/authenticatedStartParam=valid\.startParam/);
  assert.match(intake,/safeIntake\(payload,demo\)/);
  assert.match(intake,/authenticatedStartParam\?\?"direct"/);
});

test("public JSON mutation routes enforce bounded streamed bodies",async()=>{
  const helper=await source("apps/web/lib/http.ts");
  const routes=await Promise.all([
    "apps/web/app/api/intake/route.ts",
    "apps/web/app/api/telegram/validate/route.ts",
    "apps/web/app/api/invoices/[id]/verify/route.ts",
    "apps/web/app/api/jobs/[id]/accept/route.ts",
    "apps/web/app/api/privacy/deletion/route.ts",
    "apps/web/app/api/testimonials/route.ts",
    "apps/web/app/api/tickets/[id]/messages/route.ts",
  ].map(source));
  assert.match(helper,/total>maxBytes/);
  assert.match(helper,/JSON_REQUIRED/);
  for(const route of routes)assert.match(route,/readJsonBody/);
});

test("financial and delivery state transitions enforce database-bound evidence",async()=>{
  const database=await source("packages/database/src/index.ts");
  const migration=await source("packages/database/migrations/013_financial_integrity.sql");
  assert.match(database,/canonicalTransactionHash/);
  assert.match(database,/usdReferenceMinor/);
  assert.match(database,/DELIVERY_EVIDENCE_REQUIRED/);
  assert.match(database,/reasonEncrypted/);
  assert.match(migration,/quotes_currency_network_pair/);
  assert.match(migration,/invoices_token_network_pair/);
});

test("client payment evidence is allowlisted and flagged referrals remain non-payable",async()=>{
  const database=await source("packages/database/src/index.ts");
  assert.match(database,/publicPaymentEvidence\(row\.verification_evidence\)/);
  assert.match(database,/for\(const key of \["txHash","network","success","tokenContract","from","to","amountMinor","confirmations","timestamp","manualOverride","recordedAt"\]\)/);
  assert.doesNotMatch(database,/verificationEvidence:row\.verification_evidence/);
  assert.match(database,/jsonb_array_length\(r\.fraud_flags\)/);
  assert.match(database,/THEN 'pending_approval' ELSE 'not_eligible'/);
});

test("connected CI requires a committed frozen pnpm lockfile",async()=>{
  const workflow=await source(".github/workflows/ci.yml");
  const validator=await source("scripts/validate.ts");
  assert.match(workflow,/pnpm install --frozen-lockfile/);
  assert.match(validator,/process\.env\.REQUIRE_LOCKFILE==="true"/);
  assert.match(validator,/pnpm-lock\.yaml/);
});

test("all web-imported workspace packages expose TypeScript entrypoints for Next",async()=>{
  const nextConfig=await source("apps/web/next.config.ts");
  const databasePackage=JSON.parse(await source("packages/database/package.json")) as {exports?:string};
  assert.equal(databasePackage.exports,"./src/index.ts");
  for(const name of ["@jawad/database","@jawad/domain","@jawad/qualification","@jawad/security","@jawad/telegram","@jawad/payments","@jawad/attachments","@jawad/config"])assert.match(nextConfig,new RegExp(name.replace("/","\\/")));
});
