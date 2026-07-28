import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("..",import.meta.url);
async function source(path:string){return readFile(new URL(path,root),"utf8")}

test("Mini App client-message payload matches the API contract",async()=>{
  const mini=await source("apps/web/components/MiniAppShell.tsx");
  const route=await source("apps/web/app/api/tickets/[id]/messages/route.ts");
  assert.match(mini,/JSON\.stringify\(\{body:message\}\)/);
  assert.match(route,/body\?\.body/);
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
