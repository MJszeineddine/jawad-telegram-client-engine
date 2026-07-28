import test from "node:test"; import assert from "node:assert/strict"; import {createHmac} from "node:crypto"; import {validateTelegramInitData,validateAttachment,redactSecrets,scoreDemandSignal,mayMonitorGroup,SlidingWindowRateLimiter, demandAlertDecision} from "../packages/telegram/src/index.ts";
function signed(token:string,auth:number,extra:Record<string,string>={}){const p=new URLSearchParams({auth_date:String(auth),query_id:"q",user:JSON.stringify({id:123,first_name:"A"}),...extra});const data=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("\n");const secret=createHmac("sha256","WebAppData").update(token).digest();p.set("hash",createHmac("sha256",secret).update(data).digest("hex"));return p.toString()}
test("validates Telegram Mini App init data",()=>{const now=1000;const valid=validateTelegramInitData(signed("token",now,{start_param:"partner_agency"}),"token",900,now);assert.equal(valid.ok,true);assert.equal(valid.startParam,"partner_agency");assert.equal(validateTelegramInitData(signed("token",now),"wrong",900,now).reason,"INVALID_HASH");assert.equal(validateTelegramInitData(signed("token",1),"token",10,now).reason,"STALE_AUTH_DATE")});
test("rejects a signed Telegram payload without a valid positive user id",()=>{const now=1000;const payload=signed("token",now,{user:JSON.stringify({first_name:"No id"})});assert.equal(validateTelegramInitData(payload,"token",900,now).user,undefined)});
test("attachment policy sanitises and blocks secrets",()=>{assert.equal(validateAttachment({name:"screen shot.png",mime:"image/png",size:10}).safeName,"screen_shot.png");assert.equal(validateAttachment({name:".env.zip",mime:"application/zip",size:10}).ok,false);assert.equal(validateAttachment({name:"x.exe",mime:"application/octet-stream",size:10}).ok,false)});
test("redacts secrets in previews",()=>{const r=redactSecrets("token=abc123 password: hello 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");assert.doesNotMatch(r,/abc123|hello|01234567/)});
test("group monitor is opt-in and notify-only scoring",()=>{assert.equal(mayMonitorGroup({botAdded:true,adminAuthorised:true,privacyAllows:true}),true);assert.equal(mayMonitorGroup({botAdded:true,adminAuthorised:false,privacyAllows:true}),false);const s=scoreDemandSignal("Urgent: looking for a developer, paid production bug today");assert.ok(s.score>=10);assert.match(s.suggestedManualResponse,/Reply manually/) });

test("rate limiter blocks floods and reports retry",()=>{const r=new SlidingWindowRateLimiter(2,1000);assert.equal(r.allow("u",0).allowed,true);assert.equal(r.allow("u",1).allowed,true);const x=r.allow("u",2);assert.equal(x.allowed,false);assert.ok(x.retryAfterMs>0);assert.equal(r.allow("u",1001).allowed,true)});

test("demand monitor honours authorisation, threshold, quiet hours, and approved templates", () => {
  const base={enabled:true,adminAuthorised:true,minimumScore:6,responseMode:"notify_only" as const};
  assert.equal(demandAlertDecision("need a developer for a paid production bug",base,new Date("2026-07-28T12:00:00Z")).alert,true);
  assert.equal(demandAlertDecision("need a developer",{...base,quietHours:{startHour:22,endHour:7,utcOffsetMinutes:0}},new Date("2026-07-28T23:00:00Z")).reason,"QUIET_HOURS");
  assert.equal(demandAlertDecision("need a developer",{...base,adminAuthorised:false}).alert,false);
  const approved=demandAlertDecision("need a developer for a paid production bug",{...base,responseMode:"approved_template",approvedTemplate:"Admin-approved response"},new Date("2026-07-28T12:00:00Z"));
  assert.equal(approved.automaticReply,true);
});

test("demand categories can be disabled without changing safety penalties",()=>{
  const disabled=scoreDemandSignal("Urgent paid production bug today",["developer_request"]);
  assert.equal(disabled.matches.includes("production bug"),false);
  const enabled=scoreDemandSignal("Urgent paid production bug today",["production_deployment","urgent_today"]);
  assert.equal(enabled.matches.includes("production bug"),true);
  assert.ok(enabled.matchedCategoryIds.includes("production_deployment"));
  const filtered=demandAlertDecision("React error in production",{enabled:true,adminAuthorised:true,minimumScore:1,enabledCategories:["database_auth"],responseMode:"notify_only"});
  assert.equal(filtered.alert,false);
});
