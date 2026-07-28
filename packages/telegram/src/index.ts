import { createHmac, timingSafeEqual } from "node:crypto";
export function validateTelegramInitData(initData:string, botToken:string, maxAgeSeconds=900, nowSeconds=Math.floor(Date.now()/1000)) {
  const p=new URLSearchParams(initData); const hash=p.get("hash"); if(!hash) return {ok:false,reason:"MISSING_HASH"};
  const authDate=Number(p.get("auth_date")); if(!Number.isFinite(authDate) || nowSeconds-authDate>maxAgeSeconds || authDate>nowSeconds+30) return {ok:false,reason:"STALE_AUTH_DATE"};
  p.delete("hash"); const dataCheck=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("\n");
  const secret=createHmac("sha256","WebAppData").update(botToken).digest();
  const expected=createHmac("sha256",secret).update(dataCheck).digest("hex");
  const a=Buffer.from(expected,"hex"), b=Buffer.from(hash,"hex");
  return a.length===b.length && timingSafeEqual(a,b) ? {ok:true,reason:"VALID",user:parseUser(p.get("user"))} : {ok:false,reason:"INVALID_HASH"};
}
function parseUser(raw:string|null){ if(!raw) return undefined; try { const x=JSON.parse(raw); return {id:String(x.id),username:typeof x.username==="string"?x.username:undefined,firstName:typeof x.first_name==="string"?x.first_name:undefined}; } catch { return undefined; } }

const allowedExtensions=new Set(["png","jpg","jpeg","webp","txt","log","pdf","zip"]);
const allowedMimes=new Set(["image/png","image/jpeg","image/webp","text/plain","application/pdf","application/zip","application/x-zip-compressed"]);
export function validateAttachment(input:{name:string;mime:string;size:number}, maxBytes=10*1024*1024){
  const safeName=input.name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g,"_").replace(/\.{2,}/g,".").slice(0,120);
  const ext=safeName.split(".").pop()?.toLowerCase() ?? "";
  const errors:string[]=[]; if(!allowedExtensions.has(ext)) errors.push("EXTENSION_NOT_ALLOWED"); if(!allowedMimes.has(input.mime)) errors.push("MIME_NOT_ALLOWED"); if(input.size<=0 || input.size>maxBytes) errors.push("SIZE_LIMIT");
  if(/(^|\.)env($|\.)|private.?key|seed.?phrase/i.test(safeName)) errors.push("POTENTIAL_SECRET_FILE");
  return {ok:errors.length===0,safeName,errors};
}
export function redactSecrets(text:string){ return text
  .replace(/\b(?:sk|pk)_[A-Za-z0-9_-]{16,}\b/g,"[REDACTED_API_KEY]")
  .replace(/\b[A-Fa-f0-9]{64}\b/g,"[REDACTED_64_HEX]")
  .replace(/(password|token|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi,"$1=[REDACTED]")
  .replace(/\b(?:[a-z]+\s+){11,23}[a-z]+\b/gi, m=>m.split(/\s+/).length>=12?"[REDACTED_POSSIBLE_SEED_PHRASE]":m);
}
export const demandCategoryDefinitions = {
  developer_request: { label: "Developer request", phrases: { "need a developer": 5, "looking for a developer": 5 } },
  react_next: { label: "React / Next.js", phrases: { "react error": 4, "next.js issue": 4 } },
  node_api: { label: "Node.js / API", phrases: { "node.js problem": 4, "api broken": 4 } },
  production_deployment: { label: "Production / deployment", phrases: { "deployment failed": 5, "production bug": 5 } },
  database_auth: { label: "Database / authentication", phrases: { "database error": 4, "authentication issue": 4 } },
  urgent_today: { label: "Urgent same-day need", phrases: { "need someone today": 3 } },
  unfinished_handoff: { label: "Unfinished work / abandoned project", phrases: { "unfinished mvp": 4, "previous developer disappeared": 5 } },
} as const;
export type DemandCategoryId = keyof typeof demandCategoryDefinitions;
export const allDemandCategoryIds = Object.keys(demandCategoryDefinitions) as DemandCategoryId[];
export function isDemandCategoryId(value:string):value is DemandCategoryId{return value in demandCategoryDefinitions}
export function scoreDemandSignal(text:string,enabledCategories:readonly DemandCategoryId[]=allDemandCategoryIds){
  const low=text.toLowerCase();
  const enabled=new Set(enabledCategories);
  const weightedPhrases=Object.entries(demandCategoryDefinitions).flatMap(([category,definition])=>enabled.has(category as DemandCategoryId)?Object.entries(definition.phrases).map(([phrase,weight])=>({category:category as DemandCategoryId,phrase,weight:Number(weight)})):[]);
  const matches=weightedPhrases.filter(({phrase})=>low.includes(phrase));
  let score=matches.reduce((n,{weight})=>n+weight,0);
  if(enabled.has("urgent_today")&&/\b(help|urgent|today|asap)\b/i.test(text)) score+=2;
  if(/\b(hiring|paid|budget|contract)\b/i.test(text)) score+=2;
  if(/course|tutorial|homework/i.test(text)) score-=4;
  return {score:Math.max(0,score),matches:matches.map(({phrase})=>phrase),matchedCategoryIds:[...new Set(matches.map(({category})=>category))],suggestedManualResponse: score>=6?"Reply manually with a concise offer and the bot intake link.":"Review manually; no outreach is recommended yet."};
}
export function mayMonitorGroup(input:{botAdded:boolean;adminAuthorised:boolean;privacyAllows:boolean}){ return input.botAdded&&input.adminAuthorised&&input.privacyAllows; }


export class SlidingWindowRateLimiter {
  private hits=new Map<string,number[]>();
  private readonly limit:number;
  private readonly windowMs:number;
  constructor(limit:number,windowMs:number){this.limit=limit;this.windowMs=windowMs}
  allow(key:string,now=Date.now()){const cutoff=now-this.windowMs;const xs=(this.hits.get(key)??[]).filter(x=>x>cutoff);if(xs.length>=this.limit){this.hits.set(key,xs);return{allowed:false,retryAfterMs:Math.max(1,xs[0]!+this.windowMs-now)}}xs.push(now);this.hits.set(key,xs);return{allowed:true,retryAfterMs:0}}
}

export interface DemandMonitorSettings {
  enabled: boolean;
  adminAuthorised: boolean;
  minimumScore: number;
  enabledCategories?: DemandCategoryId[];
  quietHours?: { startHour: number; endHour: number; utcOffsetMinutes: number };
  responseMode: "notify_only" | "approved_template";
  approvedTemplate?: string;
}
export function demandAlertDecision(text: string, settings: DemandMonitorSettings, now = new Date()) {
  if (!settings.enabled || !settings.adminAuthorised) return { alert: false, reason: "MONITOR_NOT_AUTHORISED", automaticReply: false };
  if (settings.quietHours) {
    const localMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + settings.quietHours.utcOffsetMinutes + 1_440) % 1_440;
    const hour = Math.floor(localMinutes / 60);
    const { startHour, endHour } = settings.quietHours;
    const quiet = startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
    if (quiet) return { alert: false, reason: "QUIET_HOURS", automaticReply: false };
  }
  const signal = scoreDemandSignal(text,settings.enabledCategories?.length?settings.enabledCategories:allDemandCategoryIds);
  if (signal.score < settings.minimumScore) return { alert: false, reason: "BELOW_THRESHOLD", automaticReply: false, signal };
  const automaticReply = settings.responseMode === "approved_template" && Boolean(settings.approvedTemplate?.trim());
  return { alert: true, reason: "MATCH", automaticReply, signal, ...(automaticReply ? { approvedTemplate: settings.approvedTemplate } : {}) };
}
