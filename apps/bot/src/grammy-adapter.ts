import { createServer } from "node:http";
import { createHash,timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { processMockUpdate, commands } from "./core.ts";
import { startWizard, answerWizard, cancelWizard, resumeWizard, currentPrompt, type WizardSession, type WizardKind } from "./wizard.ts";
import { validateAttachment, demandAlertDecision, mayMonitorGroup, SlidingWindowRateLimiter, type DemandCategoryId } from "../../../packages/telegram/src/index.ts";
import { LocalAttachmentStore, type StoredAttachment } from "../../../packages/attachments/src/index.ts";
import { MemoryBotWizardStore, type BotWizardStore } from "./session-store.ts";

function safeEqual(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
function wizardKind(value:string):WizardKind|undefined{return value==="fix"||value==="agency"||value==="rescue"?value:undefined}
async function readBoundedBody(response:Response,maxBytes:number):Promise<Buffer>{
  if(!response.body)throw new Error("EMPTY_ATTACHMENT_RESPONSE");
  const reader=response.body.getReader();const chunks:Buffer[]=[];let total=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes)throw new Error("ATTACHMENT_TOO_LARGE_DURING_DOWNLOAD");chunks.push(Buffer.from(value))}return Buffer.concat(chunks,total)}finally{reader.releaseLock()}
}

export interface BotGroupMonitor {enabled:boolean;adminAuthorised:boolean;minimumScore:number;enabledCategories?:DemandCategoryId[];quietHours?:{startHour:number;endHour:number;utcOffsetMinutes:number};responseMode:"notify_only"|"approved_template";approvedTemplate?:string;retentionDays:number}
export interface ProductionBotInput {token:string;adminChatId?:string;webhookSecret?:string;authorisedGroupIds?:string[];attachmentRoot?:string;attachmentRetentionDays?:number;miniAppUrl?:string;sessionStore?:BotWizardStore;loadCapacitySummary?:()=>Promise<string>;loadGroupMonitor?:(groupId:string)=>Promise<BotGroupMonitor|null>;claimUpdate?:(updateId:string,payloadDigest:string)=>Promise<boolean>;completeUpdate?:(updateId:string,outcome:string)=>Promise<void>;releaseUpdate?:(updateId:string)=>Promise<void>;onStartAttribution?:(event:{telegramUserId:string;startParam:string})=>Promise<void>;onDemandSignal?:(event:{groupId:string;messageId:string;excerpt:string;score:number;matchedCategories:string[];authorUserId?:string;retainedUntil:Date})=>Promise<void>;onWizardCompleted?:(event:{session:WizardSession;telegramUserId:string;username?:string;startParam?:string;attachments:StoredAttachment[]})=>Promise<{leadId:string;attachmentsPersisted:boolean}>}
export async function createProductionBot(input:ProductionBotInput){
  const { Bot, InlineKeyboard } = await import("grammy") as any;
  const bot = new Bot(input.token);
  const sessionStore=input.sessionStore??new MemoryBotWizardStore();
  const rateLimiter = new SlidingWindowRateLimiter(20,60_000);
  const attachmentStore = new LocalAttachmentStore(input.attachmentRoot??join(process.cwd(),"uploads"));
  const mainKeyboard=()=>new InlineKeyboard().text("Fix a Bug","wizard:fix").text("Agency Overflow","wizard:agency").row().text("Production Rescue","wizard:rescue").text("View Portfolio","portfolio").row().text("Check Availability","availability").text("How It Works","how");

  bot.use(async(ctx:any,next:any)=>{const updateId=String(ctx.update.update_id);if(input.claimUpdate){const digest=createHash("sha256").update(JSON.stringify(ctx.update)).digest("hex");if(!await input.claimUpdate(updateId,digest))return;try{await next();await input.completeUpdate?.(updateId,"processed")}catch(error){await input.releaseUpdate?.(updateId).catch(()=>undefined);throw error}return}return next()});
  bot.use(async(ctx:any,next:any)=>{const id=String(ctx.from?.id??ctx.chat?.id??"unknown");const limit=rateLimiter.allow(id);if(!limit.allowed)return ctx.reply(`Please slow down. Retry in ${Math.ceil(limit.retryAfterMs/1000)} seconds.`);return next()});
  bot.command("start",async(ctx:any)=>{const key=String(ctx.from.id);const startParam=String(ctx.match??"");const existing=await sessionStore.get(key);await sessionStore.set(key,{...(existing??{attachments:[]}),startParam});if(startParam)await input.onStartAttribution?.({telegramUserId:String(ctx.from.id),startParam}).catch(()=>undefined);const reply=processMockUpdate({text:"/start",startParam});await ctx.reply(reply.text,{reply_markup:mainKeyboard()})});
  for(const command of ["pricing","payment","privacy","help"] as const)bot.command(command,(ctx:any)=>ctx.reply(processMockUpdate({text:`/${command}`}).text));
  bot.command("portfolio",(ctx:any)=>ctx.reply("Portfolio: https://mjszeineddine.github.io/\nGitHub: https://github.com/MJszeineddine"));
  bot.command("services",(ctx:any)=>ctx.reply("React/Next.js, Node.js/API, Python/FastAPI, PostgreSQL, authentication/RBAC, dashboards, integrations, Docker/deployment, responsiveness, existing-feature repair, and white-label agency delivery."));
  bot.command("availability",async(ctx:any)=>ctx.reply(input.loadCapacitySummary?await input.loadCapacitySummary():"Capacity is controlled manually in the dashboard. When full, the system still collects leads but does not enable immediate payment."));
  bot.command("cancel",async(ctx:any)=>{const key=String(ctx.from.id);const existing=await sessionStore.get(key);if(existing?.session)await sessionStore.set(key,{...existing,session:cancelWizard(existing.session)});await deletePending(key);return ctx.reply("Current submission cancelled and pending uploads deleted. Use /fix, /agency, or /rescue to begin again.")});
  bot.command("status",(ctx:any)=>ctx.reply("Open the Mini App and enter your ticket reference. Do not post sensitive project details in public groups."));
  for(const kind of ["fix","agency","rescue"] as const)bot.command(kind,async(ctx:any)=>beginWizard(ctx,kind));

  async function deletePending(key:string){const state=await sessionStore.get(key);await sessionStore.delete(key);await Promise.all((state?.attachments??[]).map(record=>attachmentStore.delete(record).catch(()=>undefined)))}
  async function beginWizard(ctx:any,kind:WizardKind){const key=String(ctx.from.id);const previous=await sessionStore.get(key);await Promise.all((previous?.attachments??[]).map(record=>attachmentStore.delete(record).catch(()=>undefined)));const session=startWizard(kind);await sessionStore.set(key,{session,...(previous?.startParam?{startParam:previous.startParam}:{}),attachments:[]});await ctx.reply(`Starting ${kind.replace("-"," ")} intake. You may attach up to 5 safe files while the wizard is active. Do not send passwords, tokens, .env files, private keys, seed phrases, or database dumps.\n\n${currentPrompt(session)?.prompt}`)}
  bot.callbackQuery(/^wizard:(fix|agency|rescue)$/,async(ctx:any)=>{const kind=wizardKind(ctx.match[1]);if(!kind)return ctx.answerCallbackQuery();await beginWizard(ctx,kind);return ctx.answerCallbackQuery()});
  bot.callbackQuery("portfolio",async(ctx:any)=>{await ctx.answerCallbackQuery();await ctx.reply("https://mjszeineddine.github.io/")});
  bot.callbackQuery("availability",async(ctx:any)=>{await ctx.answerCallbackQuery();await ctx.reply(input.loadCapacitySummary?await input.loadCapacitySummary():"New requests are accepted for review. Payment is enabled only after manual approval and capacity confirmation.")});
  bot.callbackQuery("how",async(ctx:any)=>{await ctx.answerCallbackQuery();await ctx.reply("Submit → qualify → Jawad reviews → quote → crypto invoice → on-chain verification → paid job → delivery → client acceptance → optional testimonial/referral.")});

  bot.on("message:text",async(ctx:any)=>{
    if(ctx.chat.type!=="private"){
      const groupId=String(ctx.chat.id);const configured=await input.loadGroupMonitor?.(groupId);const fallbackAuthorised=(input.authorisedGroupIds??[]).includes(groupId);const settings:BotGroupMonitor=configured??{enabled:fallbackAuthorised,adminAuthorised:fallbackAuthorised,minimumScore:6,responseMode:"notify_only",retentionDays:30};
      if(!mayMonitorGroup({botAdded:true,adminAuthorised:settings.adminAuthorised,privacyAllows:true}))return;const decision=demandAlertDecision(ctx.message.text,settings);if(!decision.alert||!("signal" in decision))return;const signal=decision.signal;const approvedTemplate="approvedTemplate" in decision?decision.approvedTemplate:undefined;
      await input.onDemandSignal?.({groupId,messageId:String(ctx.message.message_id),excerpt:ctx.message.text.slice(0,1000),score:signal.score,matchedCategories:signal.matches,...(ctx.from?.id?{authorUserId:String(ctx.from.id)}:{}),retainedUntil:new Date(Date.now()+Math.max(1,Math.min(365,settings.retentionDays))*86_400_000)});
      if(input.adminChatId)await ctx.api.sendMessage(input.adminChatId,`Demand signal (${signal.score}) in ${ctx.chat.title??ctx.chat.id}

${ctx.message.text.slice(0,700)}

${signal.suggestedManualResponse}`);if(decision.automaticReply&&approvedTemplate)await ctx.reply(approvedTemplate);return;
    }
    if(ctx.message.text.startsWith("/"))return;
    const key=String(ctx.from.id);const state=await sessionStore.get(key);const session=state?.session;if(!session)return;
    const resumed=resumeWizard(session);if(!resumed.ok){await deletePending(key);return ctx.reply("That submission expired or was cancelled. Pending uploads were deleted. Start a new intake.")}
    const result=answerWizard(session,ctx.message.text);await sessionStore.set(key,{...state!,session:result.session});if(result.error==="POTENTIAL_SECRET")return ctx.reply("That message appears to contain a secret. Remove credentials, keys, tokens, or .env content and send a safe description.");if(result.error)return ctx.reply(result.next?.prompt??"Please provide a valid answer.");if(result.session.completed){let persisted=false;try{const latest=await sessionStore.get(key);const startParam=latest?.startParam;const attachments=latest?.attachments??[];const saved=input.onWizardCompleted?await input.onWizardCompleted({session:result.session,telegramUserId:key,...(ctx.from.username?{username:String(ctx.from.username)}:{}),...(startParam?{startParam}:{}),attachments}):undefined;persisted=Boolean(saved);if(saved&&attachments.length&&!saved.attachmentsPersisted)await deletePending(key);await ctx.reply(`Submission captured for qualification and manual review.${saved?` Ticket: ${saved.leadId}.`:""} ${attachments.length?(saved?.attachmentsPersisted?`${attachments.length} attachment(s) linked securely. `:"Attachments could not be linked and were deleted safely. "):""}Nothing is automatically accepted or invoiced.`);if(input.adminChatId&&!input.onWizardCompleted)await ctx.api.sendMessage(input.adminChatId,`New ${result.session.kind} request${saved?` ${saved.leadId}`:""} from Telegram user ${ctx.from.id}. Review it in the admin dashboard.`).catch(()=>undefined)}catch{await ctx.reply("The submission could not be stored safely. Pending uploads were deleted and no paid job was created. Please retry later.")}finally{if(persisted)await sessionStore.delete(key);else await deletePending(key)}return}return ctx.reply(result.next?.prompt??"Continue")
  });

  async function acceptAttachment(ctx:any,inputFile:{fileId:string;name:string;mime:string;size:number}){
    if(ctx.chat.type!=="private")return;const key=String(ctx.from.id);const state=await sessionStore.get(key);const session=state?.session;if(!session||session.cancelled||session.completed)return ctx.reply("Start /fix, /agency, or /rescue before sending an attachment so it can be linked to the correct ticket.");const existing=state?.attachments??[];if(existing.length>=5)return ctx.reply("Attachment limit reached. Send at most 5 files per submission.");const check=validateAttachment({name:inputFile.name,mime:inputFile.mime,size:inputFile.size});if(!check.ok)return ctx.reply(`Attachment rejected: ${check.errors.join(", ")}`);
    const file=await ctx.api.getFile(inputFile.fileId);if(!file.file_path)return ctx.reply("Telegram did not provide a downloadable file path. Please try again.");const maximumBytes=10*1024*1024;let response:Response;try{response=await fetch(`https://api.telegram.org/file/bot${input.token}/${file.file_path}`,{signal:AbortSignal.timeout(15_000)})}catch{return ctx.reply("Attachment download timed out safely. Please try again later.")}if(!response.ok)return ctx.reply("Attachment download failed safely. Please try again later.");let bytes:Buffer;try{bytes=await readBoundedBody(response,maximumBytes)}catch{return ctx.reply("Attachment exceeded the safe download limit and was rejected.")}if(bytes.length!==inputFile.size&&inputFile.size>0)return ctx.reply("Attachment size changed during download and was rejected safely.");
    try{const saved=await attachmentStore.save({name:inputFile.name,mime:inputFile.mime,bytes,retentionDays:input.attachmentRetentionDays??30});await sessionStore.set(key,{...state!,attachments:[...existing,saved]});await ctx.reply(`Attachment staged securely: ${saved.safeName} (${saved.size} bytes). Scan status: ${saved.scanStatus}. It will be linked only when the wizard completes.`)}catch(error){await ctx.reply(`Attachment rejected safely: ${error instanceof Error?error.message:"UPLOAD_FAILED"}`)}
  }
  bot.on("message:document",(ctx:any)=>{const d=ctx.message.document;return acceptAttachment(ctx,{fileId:d.file_id,name:d.file_name??"upload.bin",mime:d.mime_type??"application/octet-stream",size:d.file_size??0})});
  bot.on("message:photo",(ctx:any)=>{const photos=ctx.message.photo??[];const photo=photos.at(-1);if(!photo)return;return acceptAttachment(ctx,{fileId:photo.file_id,name:`telegram-photo-${ctx.message.message_id}.jpg`,mime:"image/jpeg",size:photo.file_size??0})});


  if(input.miniAppUrl?.startsWith("https://")) await bot.api.setChatMenuButton({ menu_button: { type: "web_app", text: "Open Dev Desk", web_app: { url: input.miniAppUrl } } }); else await bot.api.setChatMenuButton({ menu_button: { type: "commands" } });
  await bot.api.setMyCommands(commands.map(command=>({command,description:({start:"Open the Dev Desk",fix:"Submit one technical bug",agency:"Submit agency overflow work",rescue:"Request production rescue",portfolio:"View engineering work",services:"View supported services",pricing:"View starting packages",availability:"Check current capacity",payment:"View supported crypto payments",status:"Check an existing ticket",privacy:"View privacy and security rules",cancel:"Cancel the current submission",help:"Get help"} as Record<string,string>)[command]!})));
  return bot;
}

export async function runProductionBot(input:ProductionBotInput){
  const bot=await createProductionBot(input);const port=Number(process.env.BOT_WEBHOOK_PORT??0);if(!port){await bot.start({allowed_updates:["message","callback_query"]});return}
  if(!input.webhookSecret)throw new Error("TELEGRAM_WEBHOOK_SECRET is required in webhook mode");
  const webhookSecret = input.webhookSecret;
  const server = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ ok: true, service: "telegram-bot" }));
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }
    const provided = String(req.headers["x-telegram-bot-api-secret-token"] ?? "");
    if (!safeEqual(provided, webhookSecret)) {
      res.writeHead(403).end();
      return;
    }
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > 1_000_000) {
        res.writeHead(413).end();
        return;
      }
      chunks.push(buffer);
    }
    try {
      await bot.handleUpdate(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      res.writeHead(200).end();
    } catch {
      res.writeHead(500).end();
    }
  });
  server.listen(port, () => {
    console.log(JSON.stringify({ level: "info", service: "bot", mode: "webhook", port }));
  });
}
