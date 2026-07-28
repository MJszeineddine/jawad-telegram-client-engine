import type { Intake, QualificationResult } from "../../domain/src/index.ts";
import type { NormalizedTransfer } from "../../payments/src/index.ts";
import { decryptJson, encryptJson, type EncryptedEnvelope } from "../../security/src/index.ts";

export interface QuoteDetail {
  id: string;
  scope: string;
  acceptanceTest: string[];
  priceMinor: string;
  currency: "USDT" | "USDC";
  network: "TRON_TRC20" | "BASE_USDC";
  deliveryWindow: string;
  exclusions: string[];
  includedWork: string[];
  refundTerms: string;
  expiresAt: string;
  approvedAt?: string;
}
export interface InvoiceDetail {
  id: string;
  quoteId: string;
  status: "open" | "paid" | "expired" | "ambiguous" | "manual_review";
  network: "TRON_TRC20" | "BASE_USDC";
  token: "USDT" | "USDC";
  recipientAddress: string;
  tokenContract: string;
  amountMinor: string;
  decimals: number;
  expiresAt: string;
  createdAt: string;
  txHash?: string;
  paidAt?: string;
  referenceUsdMinor?: string;
  verificationEvidence?: Record<string,unknown>;
}
export interface JobDetail {
  id: string;
  leadId?: string;
  status: string;
  scope: string;
  acceptanceTest: string[];
  accessChecklist: string[];
  reproduction?: string[];
  proof: unknown[];
  testResults: unknown[];
  deliveryMessage?: string;
  internalNotes?: string;
  deadline?: string;
  createdAt: string;
  attachments?: AttachmentDetail[];
}
export interface LeadSummary {
  id: string;
  status: string;
  intakeKind: string;
  telegramUsername?: string;
  attributionSource: string;
  createdAt: string;
  qualification?: QualificationResult;
}
export interface AttachmentDetail {
  id: string;
  leadId?: string;
  jobId?: string;
  storageKey: string;
  safeName: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  sha256: string;
  scanStatus: string;
  deleteAfter: string;
  createdAt: string;
}
export interface CapacitySettingsDetail {
  maximumActiveQuickFixes: number;
  maximumRescueJobs: number;
  pauseCheckout: boolean;
  nextAvailableDate?: string;
  workingHours: Record<string, unknown>;
  awayMode: boolean;
}
export interface GroupMonitorDetail {
  groupId: string;
  title: string;
  adminAuthorised: boolean;
  enabled: boolean;
  minimumScore: number;
  keywordCategories: string[];
  quietHours?: Record<string, unknown>;
  responseMode: "notify_only" | "approved_template";
  approvedTemplate?: string;
  retentionDays: number;
  authorisedBy?: string;
  authorisedAt?: string;
}
export interface DueNotification {
  id: string;
  kind: string;
  recipientChatId: string;
  leadId?: string;
  jobId?: string;
  payload: Record<string, unknown>;
  attempts: number;
}
export interface PartnerStatsDetail {
  id:string;
  slug:string;
  name:string;
  commissionBps:number;
  status:"active"|"paused";
  ownerTelegramUserId?:string;
  telegramStarts:number;
  qualifiedLeads:number;
  paidJobs:number;
  collectedMinor:string;
  createdAt:string;
}
export interface ReferralLedgerDetail {
  id:string;
  partnerSlug:string;
  partnerName:string;
  leadId:string;
  status:string;
  commissionMinor?:string;
  manualPayoutStatus:string;
  fraudFlags:string[];
  createdAt:string;
}
export interface DeletionRequestDetail {id:string;telegramUserId?:string;email?:string;status:string;requestedAt:string;completedAt?:string;notes?:string}
export interface DeletionWorkDetail {requestId:string;telegramUserId:string;attachments:Array<{id:string;storageKey:string}>}
export interface ConversationDetail {id:string;direction:"client"|"jawad"|"system";body:string;createdAt:string;}
export interface LeadDetail extends LeadSummary {
  intake: Intake;
  internalNotes?: string;
  latestQuote?: QuoteDetail;
  latestInvoice?: InvoiceDetail;
  job?: JobDetail;
  attachments: AttachmentDetail[];
  conversation: ConversationDetail[];
}
export interface DashboardSnapshot { counts: Record<string, number>; leads: LeadSummary[]; }
export interface CreateLeadInput {
  telegramUserId?: string;
  telegramUsername?: string;
  intake: Intake;
  qualification: QualificationResult;
  attributionSource: string;
  partnerSlug?: string;
  status: string;
}
export interface QuoteInput {
  leadId: string;
  scope: string;
  acceptanceTest: string[];
  priceMinor: bigint;
  currency: "USDT" | "USDC";
  network: "TRON_TRC20" | "BASE_USDC";
  deliveryWindow: string;
  exclusions: string[];
  includedWork: string[];
  refundTerms: string;
  expiresAt: Date;
  approvedBy: string;
}
export interface CreateInvoiceInput {
  quoteId: string;
  network: "TRON_TRC20" | "BASE_USDC";
  recipientAddress: string;
  tokenContract: string;
  decimals: number;
  expiresAt: Date;
  actor: string;
}
export interface RecordAttachmentInput { leadId:string;storageKey:string;originalName:string;safeName:string;mime:string;sizeBytes:number;sha256:string;scanStatus:string;deleteAfter:Date; }
export interface RecordJobAttachmentInput { jobId:string;storageKey:string;originalName:string;safeName:string;mime:string;sizeBytes:number;sha256:string;scanStatus:string;deleteAfter:Date; }
export interface ConfirmPaymentInput {
  invoiceId: string;
  transfer: NormalizedTransfer;
  minConfirmations: number;
  actor: string;
  referenceUsdMinor?: bigint;
}
export interface PaymentConfirmationResult { invoiceId: string; jobId: string; code: "PAYMENT_CONFIRMED" | "ALREADY_PAID_IDEMPOTENT"; }
export interface ClientTicket { id:string;status:string;createdAt:string;quote?:QuoteDetail;invoice?:InvoiceDetail;job?:JobDetail;conversation:ConversationDetail[]; }

export interface DatabaseRepository {
  createLead(input: CreateLeadInput): Promise<string>;
  dashboard(): Promise<DashboardSnapshot>;
  getLead(id: string): Promise<LeadDetail | null>;
  createApprovedQuote(input: QuoteInput): Promise<string>;
  createInvoiceForQuote(input: CreateInvoiceInput): Promise<string>;
  getInvoiceForClient(id: string, telegramUserId: string): Promise<InvoiceDetail | null>;
  getClientTicket(id: string, telegramUserId: string): Promise<ClientTicket | null>;
  listOpenInvoices(limit?:number):Promise<InvoiceDetail[]>;
  markInvoiceAmbiguous(id:string,txHashes:string[],actor:string):Promise<void>;
  expireOpenInvoices(now?:Date):Promise<number>;
  listExpiredAttachments(limit?:number):Promise<Array<{id:string;storageKey:string}>>;
  deleteAttachmentRecord(id:string,actor:string):Promise<void>;
  deleteExpiredDemandSignals(now?:Date):Promise<number>;
  recordLeadAttachment(input:RecordAttachmentInput):Promise<string>;
  recordLeadAttachments(inputs:RecordAttachmentInput[]):Promise<string[]>;
  recordJobAttachment(input:RecordJobAttachmentInput):Promise<string>;
  getAttachmentForAdmin(id:string):Promise<AttachmentDetail|null>;
  getAttachmentForClient(id:string,telegramUserId:string):Promise<AttachmentDetail|null>;
  getCapacitySettings():Promise<CapacitySettingsDetail>;
  updateCapacitySettings(input:CapacitySettingsDetail,actor:string):Promise<void>;
  listGroupMonitors():Promise<GroupMonitorDetail[]>;
  getGroupMonitor(groupId:string):Promise<GroupMonitorDetail|null>;
  upsertGroupMonitor(input:GroupMonitorDetail,actor:string):Promise<void>;
  recordDemandSignal(input:{groupId:string;messageId:string;excerpt:string;score:number;matchedCategories:string[];authorUserId?:string;retainedUntil:Date}):Promise<string>;
  recordPartnerStart(slug:string,telegramUserId?:string,campaign?:string):Promise<boolean>;
  claimTelegramUpdate(updateId:string,payloadDigest:string):Promise<boolean>;
  completeTelegramUpdate(updateId:string,outcome:string):Promise<void>;
  releaseTelegramUpdate(updateId:string):Promise<void>;
  listPartnerStats():Promise<PartnerStatsDetail[]>;
  createPartner(input:{slug:string;name:string;commissionBps:number;status:"active"|"paused";ownerTelegramUserId?:string},actor:string):Promise<string>;
  listReferralLedger():Promise<ReferralLedgerDetail[]>;
  updateReferralPayoutStatus(id:string,status:"pending_approval"|"paid"|"rejected",actor:string):Promise<boolean>;
  createDeletionRequest(input:{telegramUserId?:string;email?:string;notes?:string}):Promise<string>;
  listDeletionRequests():Promise<DeletionRequestDetail[]>;
  getDeletionWork(id:string):Promise<DeletionWorkDetail|null>;
  completeDeletionRequest(id:string,actor:string):Promise<boolean>;
  addClientMessage(input:{leadId:string;telegramUserId:string;body:string}):Promise<string>;
  addAdminMessage(input:{leadId:string;actor:string;body:string}):Promise<string>;
  acceptJob(input:{jobId:string;telegramUserId:string;feedback?:string}):Promise<{ticketId:string}>;
  submitTestimonial(input:{jobId:string;telegramUserId:string;response:string;permissionToPublish:boolean}):Promise<string>;
  queueNotification(input:{kind:string;recipientChatId:string;leadId?:string;jobId?:string;payload:Record<string,unknown>}):Promise<string>;
  listDueNotifications(limit?:number):Promise<DueNotification[]>;
  markNotificationSent(id:string):Promise<void>;
  markNotificationFailed(id:string,error:string,nextAttemptAt:Date):Promise<void>;
  listDueDeadlineReminders(limit?:number):Promise<Array<{jobId:string;deadline:string}>>;
  markDeadlineReminded(jobId:string):Promise<void>;
  confirmPayment(input: ConfirmPaymentInput): Promise<PaymentConfirmationResult>;
  manualConfirmPayment(input:{invoiceId:string;txHash:string;reason:string;actor:string}):Promise<PaymentConfirmationResult>;
  recordVerificationFailure(invoiceId: string, txHash: string, provider: string, outcome: string, evidence: unknown): Promise<void>;
  getJob(id: string): Promise<JobDetail | null>;
  getLeadTelegramTarget(id:string):Promise<{telegramUserId:string;ticketId:string}|null>;
  getJobTelegramTarget(id:string):Promise<{telegramUserId:string;ticketId:string}|null>;
  updateJobStatus(id: string, status: string, actor: string, input?: { deliveryMessage?: string; proof?: unknown[]; testResults?: unknown[] }): Promise<boolean>;
  updateJobDetails(id:string,actor:string,input:{accessChecklist:string[];internalNotes?:string;deadline?:Date|null}):Promise<boolean>;
  updateLeadStatus(id: string, status: string, actor: string, reason?: string): Promise<boolean>;
  close(): Promise<void>;
}

function encrypted(value: unknown): value is EncryptedEnvelope {
  return Boolean(value && typeof value === "object" && (value as { algorithm?: string }).algorithm === "aes-256-gcm");
}
function intakeAfterDeletion(intake:Intake):Intake{const{company,contactPreference,applicationUrl,accessMethodPreference,agencyWebsite,contactRole,endClientRequirement,communicationArrangement,businessImpact,repositoryDescription,deploymentProvider,database,requiredAccess,errorMessage,deadline,budget,recentChange,acceptanceCriteria,referralSlug,...retained}=intake;void company;void contactPreference;void applicationUrl;void accessMethodPreference;void agencyWebsite;void contactRole;void endClientRequirement;void communicationArrangement;void businessImpact;void repositoryDescription;void deploymentProvider;void database;void requiredAccess;void errorMessage;void deadline;void budget;void recentChange;void acceptanceCriteria;void referralSlug;return{...retained,name:"Deleted user",brokenBehaviour:"[Deleted by user request]",expectedBehaviour:"[Deleted by user request]",reproductionSteps:[]}}
function quoteFromRow(row: any): QuoteDetail | undefined {
  if (!row?.quote_id) return undefined;
  return { id:String(row.quote_id),scope:String(row.quote_scope),acceptanceTest:(row.quote_acceptance_test??[]) as string[],priceMinor:String(row.quote_price_minor),currency:String(row.quote_currency) as QuoteDetail["currency"],network:String(row.quote_network) as QuoteDetail["network"],deliveryWindow:String(row.quote_delivery_window),exclusions:(row.quote_exclusions??[]) as string[],includedWork:(row.quote_included_work??[]) as string[],refundTerms:String(row.quote_refund_terms??"Manual review only; no automatic refund."),expiresAt:new Date(row.quote_expires_at).toISOString(),...(row.quote_approved_at?{approvedAt:new Date(row.quote_approved_at).toISOString()}:{}) };
}
function invoiceFromRow(row: any): InvoiceDetail | undefined {
  if (!row?.invoice_id) return undefined;
  return { id:String(row.invoice_id),quoteId:String(row.invoice_quote_id),status:String(row.invoice_status) as InvoiceDetail["status"],network:String(row.invoice_network) as InvoiceDetail["network"],token:String(row.invoice_token) as InvoiceDetail["token"],recipientAddress:String(row.invoice_recipient_address),tokenContract:String(row.invoice_token_contract),amountMinor:String(row.invoice_amount_minor),decimals:Number(row.invoice_decimals),expiresAt:new Date(row.invoice_expires_at).toISOString(),createdAt:new Date(row.invoice_created_at??row.created_at).toISOString(),...(row.invoice_tx_hash?{txHash:String(row.invoice_tx_hash)}:{}),...(row.invoice_paid_at?{paidAt:new Date(row.invoice_paid_at).toISOString()}:{}) };
}
function jobFromRow(row: any): JobDetail | undefined {
  if (!row?.job_id) return undefined;
  return { id:String(row.job_id),status:String(row.job_status),scope:String(row.job_scope),acceptanceTest:(row.job_acceptance_test??[]) as string[],accessChecklist:(row.job_access_checklist??[]) as string[],proof:(row.job_proof??[]) as unknown[],testResults:(row.job_test_results??[]) as unknown[],...(row.job_delivery_message?{deliveryMessage:String(row.job_delivery_message)}:{}),...(row.job_internal_notes?{internalNotes:String(row.job_internal_notes)}:{}),...(row.job_deadline?{deadline:new Date(row.job_deadline).toISOString()}:{}),createdAt:new Date(row.job_created_at).toISOString() };
}

export async function createPostgresRepository(databaseUrl: string, dataEncryptionKey: string): Promise<DatabaseRepository> {
  if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
  const module = await import("postgres") as any;
  const postgres = module.default ?? module;
  const sql = postgres(databaseUrl, { max: 5, idle_timeout: 20, connect_timeout: 10, prepare: true });

  return {
    async createLead(input) {
      const requestedPartner = input.partnerSlug ? (await sql`SELECT id,slug,owner_telegram_user_id FROM partners WHERE slug=${input.partnerSlug} AND status='active' LIMIT 1`)[0] : undefined;
      let effectivePartner=requestedPartner;const fraudFlags:string[]=[];
      if(input.telegramUserId){const first=(await sql`SELECT p.id,p.slug,p.owner_telegram_user_id FROM leads l JOIN partners p ON p.id=l.partner_id WHERE l.telegram_user_id=${BigInt(input.telegramUserId)} AND l.partner_id IS NOT NULL ORDER BY l.created_at ASC LIMIT 1`)[0];if(first){effectivePartner=first;if(requestedPartner&&String(requestedPartner.id)!==String(first.id))fraudFlags.push("DUPLICATE_ATTRIBUTION_RETAINED_FIRST_TOUCH")}}
      if(effectivePartner?.owner_telegram_user_id&&input.telegramUserId&&String(effectivePartner.owner_telegram_user_id)===input.telegramUserId)fraudFlags.push("SELF_REFERRAL");
      const intakeEnvelope = encryptJson(input.intake, dataEncryptionKey);const attributionSource=effectivePartner?`partner_${String(effectivePartner.slug)}`:input.attributionSource;
      const rows = await sql`INSERT INTO leads(telegram_user_id,telegram_username,intake_kind,status,attribution_source,partner_id,intake,qualification) VALUES(${input.telegramUserId ? BigInt(input.telegramUserId) : null},${input.telegramUsername ?? null},${input.intake.kind.replaceAll("-","_")},${input.status},${attributionSource},${effectivePartner?.id ?? null},${sql.json(intakeEnvelope)},${sql.json(input.qualification)}) RETURNING id`;
      const id = String(rows[0].id);
      if(effectivePartner?.id)await sql`INSERT INTO referrals(partner_id,lead_id,status,manual_payout_status,fraud_flags) VALUES(${effectivePartner.id},${id},${fraudFlags.length?"flagged":"attributed"},${fraudFlags.length?"not_eligible":"not_eligible"},${sql.json(fraudFlags)}) ON CONFLICT(lead_id) DO NOTHING`;
      await sql`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('system','telegram-intake','lead.created','lead',${id},${sql.json({ attributionSource,fraudFlags })})`;
      return id;
    },
    async dashboard() {
      const countRows = await sql`SELECT status,COUNT(*)::int AS count FROM leads GROUP BY status`;
      const leadRows = await sql`SELECT id,status,intake_kind,telegram_username,attribution_source,qualification,created_at FROM leads ORDER BY created_at DESC LIMIT 100`;
      return { counts:Object.fromEntries(countRows.map((row:any)=>[String(row.status),Number(row.count)])),leads:leadRows.map((row:any)=>({id:String(row.id),status:String(row.status),intakeKind:String(row.intake_kind),...(row.telegram_username?{telegramUsername:String(row.telegram_username)}:{}),attributionSource:String(row.attribution_source),createdAt:new Date(row.created_at).toISOString(),...(row.qualification?{qualification:row.qualification as QualificationResult}:{})})) };
    },
    async getLead(id) {
      const rows = await sql`
        SELECT l.id,l.status,l.intake_kind,l.telegram_username,l.attribution_source,l.intake,l.qualification,l.internal_notes,l.created_at,
          q.id quote_id,q.scope quote_scope,q.acceptance_test quote_acceptance_test,q.price_minor quote_price_minor,q.currency quote_currency,q.network quote_network,q.delivery_window quote_delivery_window,q.exclusions quote_exclusions,q.included_work quote_included_work,q.refund_terms quote_refund_terms,q.expires_at quote_expires_at,q.approved_at quote_approved_at,
          i.id invoice_id,i.quote_id invoice_quote_id,i.status invoice_status,i.network invoice_network,i.token invoice_token,i.recipient_address invoice_recipient_address,i.token_contract invoice_token_contract,i.amount_minor invoice_amount_minor,i.decimals invoice_decimals,i.expires_at invoice_expires_at,i.created_at invoice_created_at,i.tx_hash invoice_tx_hash,i.paid_at invoice_paid_at,
          j.id job_id,j.status job_status,j.scope job_scope,j.acceptance_test job_acceptance_test,j.access_checklist job_access_checklist,j.proof job_proof,j.test_results job_test_results,j.delivery_message job_delivery_message,j.internal_notes job_internal_notes,j.deadline job_deadline,j.created_at job_created_at
        FROM leads l
        LEFT JOIN LATERAL(SELECT * FROM quotes WHERE lead_id=l.id ORDER BY created_at DESC LIMIT 1) q ON true
        LEFT JOIN invoices i ON i.quote_id=q.id
        LEFT JOIN jobs j ON j.lead_id=l.id
        WHERE l.id=${id} LIMIT 1`;
      const row=rows[0];if(!row)return null;const storedIntake=row.intake as unknown;const intake=encrypted(storedIntake)?decryptJson<Intake>(storedIntake,dataEncryptionKey):storedIntake as Intake;
      const attachmentRows=await sql`SELECT * FROM attachments WHERE lead_id=${id} ORDER BY created_at DESC`;
      const attachments=attachmentRows.map((attachment:any)=>({id:String(attachment.id),leadId:String(attachment.lead_id),storageKey:String(attachment.storage_key),safeName:String(attachment.safe_name),originalName:String(attachment.original_name),mime:String(attachment.mime),sizeBytes:Number(attachment.size_bytes),sha256:String(attachment.sha256),scanStatus:String(attachment.scan_status),deleteAfter:new Date(attachment.delete_after).toISOString(),createdAt:new Date(attachment.created_at).toISOString()}));
      const conversationRows=await sql`SELECT id,direction,body,created_at FROM conversations WHERE lead_id=${id} ORDER BY created_at`;
      const conversation=conversationRows.map((message:any)=>({id:String(message.id),direction:String(message.direction) as ConversationDetail["direction"],body:String(message.body),createdAt:new Date(message.created_at).toISOString()}));
      return {id:String(row.id),status:String(row.status),intakeKind:String(row.intake_kind),...(row.telegram_username?{telegramUsername:String(row.telegram_username)}:{}),attributionSource:String(row.attribution_source),intake,attachments,conversation,createdAt:new Date(row.created_at).toISOString(),...(row.qualification?{qualification:row.qualification as QualificationResult}:{}),...(row.internal_notes?{internalNotes:String(row.internal_notes)}:{}),...(quoteFromRow(row)?{latestQuote:quoteFromRow(row)!}:{}),...(invoiceFromRow(row)?{latestInvoice:invoiceFromRow(row)!}:{}),...(jobFromRow(row)?{job:jobFromRow(row)!}:{})};
    },
    async createApprovedQuote(input) {
      return sql.begin(async(tx:any)=>{const current=await tx`SELECT status FROM leads WHERE id=${input.leadId} FOR UPDATE`;if(!current[0]||!["awaiting_review","awaiting_information"].includes(String(current[0].status)))throw new Error("LEAD_NOT_QUOTABLE");const rows=await tx`INSERT INTO quotes(lead_id,scope,acceptance_test,price_minor,currency,network,delivery_window,exclusions,included_work,refund_terms,expires_at,approved_by,approved_at) VALUES(${input.leadId},${input.scope},${tx.json(input.acceptanceTest)},${input.priceMinor},${input.currency},${input.network},${input.deliveryWindow},${tx.json(input.exclusions)},${tx.json(input.includedWork)},${input.refundTerms},${input.expiresAt},${input.approvedBy},now()) RETURNING id`;await tx`UPDATE leads SET status='quote_sent' WHERE id=${input.leadId}`;await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('admin',${input.approvedBy},'quote.approved','lead',${input.leadId},${tx.json({quoteId:String(rows[0].id),network:input.network,priceMinor:input.priceMinor.toString()})})`;return String(rows[0].id)});
    },
    async createInvoiceForQuote(input) {
      return sql.begin(async(tx:any)=>{
        const existing=await tx`SELECT id FROM invoices WHERE quote_id=${input.quoteId} LIMIT 1`;if(existing[0])return String(existing[0].id);
        const rows=await tx`SELECT q.*,l.status lead_status,l.id lead_id,l.intake_kind,c.pause_checkout,c.away_mode,c.maximum_active_quick_fixes,c.maximum_rescue_jobs FROM quotes q JOIN leads l ON l.id=q.lead_id CROSS JOIN capacity_settings c WHERE q.id=${input.quoteId} FOR UPDATE OF q,l`;
        const q=rows[0];if(!q)throw new Error("QUOTE_NOT_FOUND");if(String(q.network)!==input.network)throw new Error("QUOTE_NETWORK_MISMATCH");if(String(q.lead_status)!=="quote_sent")throw new Error("LEAD_NOT_READY_FOR_INVOICE");if(new Date(q.expires_at).getTime()<=Date.now())throw new Error("QUOTE_EXPIRED");if(q.pause_checkout||q.away_mode)throw new Error("CHECKOUT_PAUSED");
        const active=await tx`SELECT intake_kind,COUNT(*)::int count FROM leads WHERE status IN('awaiting_payment','paid','in_progress','awaiting_client_acceptance') GROUP BY intake_kind`;
        const counts=Object.fromEntries(active.map((r:any)=>[String(r.intake_kind),Number(r.count)]));if(q.intake_kind==="quick_fix"&&(counts.quick_fix??0)>=Number(q.maximum_active_quick_fixes))throw new Error("QUICK_FIX_CAPACITY_FULL");if(q.intake_kind==="production_rescue"&&(counts.production_rescue??0)>=Number(q.maximum_rescue_jobs))throw new Error("RESCUE_CAPACITY_FULL");
        const inserted=await tx`INSERT INTO invoices(quote_id,status,network,token,recipient_address,token_contract,amount_minor,decimals,expires_at,reference_usd_minor) VALUES(${input.quoteId},'open',${q.network},${q.currency},${input.recipientAddress},${input.tokenContract},${q.price_minor},${input.decimals},${input.expiresAt},${BigInt(q.price_minor)/10_000n}) RETURNING id`;
        const invoiceId=String(inserted[0].id);await tx`UPDATE leads SET status='awaiting_payment' WHERE id=${q.lead_id}`;await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('admin',${input.actor},'invoice.created','invoice',${invoiceId},${tx.json({quoteId:input.quoteId,network:q.network})})`;return invoiceId;
      });
    },
    async getInvoiceForClient(id,telegramUserId) {
      const rows=await sql`SELECT i.*,pa.evidence verification_evidence FROM invoices i JOIN quotes q ON q.id=i.quote_id JOIN leads l ON l.id=q.lead_id LEFT JOIN payment_assignments pa ON pa.invoice_id=i.id WHERE i.id=${id} AND l.telegram_user_id=${BigInt(telegramUserId)} LIMIT 1`;const row=rows[0];if(!row)return null;return{id:String(row.id),quoteId:String(row.quote_id),status:String(row.status) as InvoiceDetail["status"],network:String(row.network) as InvoiceDetail["network"],token:String(row.token) as InvoiceDetail["token"],recipientAddress:String(row.recipient_address),tokenContract:String(row.token_contract),amountMinor:String(row.amount_minor),decimals:Number(row.decimals),expiresAt:new Date(row.expires_at).toISOString(),createdAt:new Date(row.created_at).toISOString(),...(row.tx_hash?{txHash:String(row.tx_hash)}:{}),...(row.paid_at?{paidAt:new Date(row.paid_at).toISOString()}:{}),...(row.reference_usd_minor!==null&&row.reference_usd_minor!==undefined?{referenceUsdMinor:String(row.reference_usd_minor)}:{}),...(row.verification_evidence?{verificationEvidence:row.verification_evidence as Record<string,unknown>}:{})};
    },
    async getClientTicket(id,telegramUserId) {
      const rows=await sql`
        SELECT l.id,l.status,l.created_at,
          q.id quote_id,q.scope quote_scope,q.acceptance_test quote_acceptance_test,q.price_minor quote_price_minor,q.currency quote_currency,q.network quote_network,q.delivery_window quote_delivery_window,q.exclusions quote_exclusions,q.included_work quote_included_work,q.refund_terms quote_refund_terms,q.expires_at quote_expires_at,q.approved_at quote_approved_at,
          i.id invoice_id,i.quote_id invoice_quote_id,i.status invoice_status,i.network invoice_network,i.token invoice_token,i.recipient_address invoice_recipient_address,i.token_contract invoice_token_contract,i.amount_minor invoice_amount_minor,i.decimals invoice_decimals,i.expires_at invoice_expires_at,i.created_at invoice_created_at,i.tx_hash invoice_tx_hash,i.paid_at invoice_paid_at,
          j.id job_id,j.status job_status,j.scope job_scope,j.acceptance_test job_acceptance_test,j.access_checklist job_access_checklist,j.proof job_proof,j.test_results job_test_results,j.delivery_message job_delivery_message,j.internal_notes job_internal_notes,j.deadline job_deadline,j.created_at job_created_at
        FROM leads l
        LEFT JOIN LATERAL(SELECT * FROM quotes WHERE lead_id=l.id ORDER BY created_at DESC LIMIT 1) q ON true
        LEFT JOIN invoices i ON i.quote_id=q.id
        LEFT JOIN jobs j ON j.lead_id=l.id
        WHERE l.id=${id} AND l.telegram_user_id=${BigInt(telegramUserId)} LIMIT 1`;
      const row=rows[0];if(!row)return null;
      const conversationRows=await sql`SELECT id,direction,body,created_at FROM conversations WHERE lead_id=${id} ORDER BY created_at`;
      const conversation=conversationRows.map((message:any)=>({id:String(message.id),direction:String(message.direction) as ConversationDetail["direction"],body:String(message.body),createdAt:new Date(message.created_at).toISOString()}));
      let job=jobFromRow(row);if(job){const attachmentRows=await sql`SELECT * FROM attachments WHERE job_id=${job.id} ORDER BY created_at DESC`;job={...job,attachments:attachmentRows.map((attachment:any)=>({id:String(attachment.id),jobId:String(attachment.job_id),storageKey:String(attachment.storage_key),safeName:String(attachment.safe_name),originalName:String(attachment.original_name),mime:String(attachment.mime),sizeBytes:Number(attachment.size_bytes),sha256:String(attachment.sha256),scanStatus:String(attachment.scan_status),deleteAfter:new Date(attachment.delete_after).toISOString(),createdAt:new Date(attachment.created_at).toISOString()}))};}
      return{id:String(row.id),status:String(row.status),createdAt:new Date(row.created_at).toISOString(),conversation,...(quoteFromRow(row)?{quote:quoteFromRow(row)!}:{}),...(invoiceFromRow(row)?{invoice:invoiceFromRow(row)!}:{}),...(job?{job}:{})};
    },
    async listOpenInvoices(limit=100){const rows=await sql`SELECT * FROM invoices WHERE status='open' ORDER BY created_at LIMIT ${Math.max(1,Math.min(500,limit))}`;return rows.map((row:any)=>({id:String(row.id),quoteId:String(row.quote_id),status:String(row.status) as InvoiceDetail["status"],network:String(row.network) as InvoiceDetail["network"],token:String(row.token) as InvoiceDetail["token"],recipientAddress:String(row.recipient_address),tokenContract:String(row.token_contract),amountMinor:String(row.amount_minor),decimals:Number(row.decimals),expiresAt:new Date(row.expires_at).toISOString(),createdAt:new Date(row.created_at).toISOString(),...(row.tx_hash?{txHash:String(row.tx_hash)}:{}),...(row.paid_at?{paidAt:new Date(row.paid_at).toISOString()}:{})}))},
    async markInvoiceAmbiguous(id,txHashes,actor){await sql.begin(async(tx:any)=>{await tx`UPDATE invoices SET status='ambiguous' WHERE id=${id} AND status='open'`;await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('system',${actor},'payment.ambiguous','invoice',${id},${tx.json({txHashes:txHashes.slice(0,20)})})`})},
    async expireOpenInvoices(now=new Date()){const rows=await sql`UPDATE invoices SET status='expired' WHERE status='open' AND expires_at<${now} RETURNING id`;return rows.length},
    async listExpiredAttachments(limit=100){const rows=await sql`SELECT id,storage_key FROM attachments WHERE delete_after<=now() ORDER BY delete_after LIMIT ${Math.max(1,Math.min(500,limit))}`;return rows.map((row:any)=>({id:String(row.id),storageKey:String(row.storage_key)}))},
    async deleteAttachmentRecord(id,actor){await sql.begin(async(tx:any)=>{const rows=await tx`DELETE FROM attachments WHERE id=${id} RETURNING lead_id,job_id,safe_name`;if(rows[0])await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('system',${actor},'attachment.deleted','attachment',${id},${tx.json({leadId:rows[0].lead_id??null,jobId:rows[0].job_id??null,safeName:rows[0].safe_name})})`})},
    async deleteExpiredDemandSignals(now=new Date()){const rows=await sql`DELETE FROM demand_signals WHERE retained_until<=${now} RETURNING id`;return rows.length},
    async recordLeadAttachment(input){const rows=await sql`INSERT INTO attachments(lead_id,storage_key,original_name,safe_name,mime,size_bytes,sha256,scan_status,delete_after) VALUES(${input.leadId},${input.storageKey},${input.originalName},${input.safeName},${input.mime},${input.sizeBytes},${input.sha256},${input.scanStatus},${input.deleteAfter}) RETURNING id`;await sql`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('system','attachment-store','attachment.created','lead',${input.leadId},${sql.json({attachmentId:String(rows[0].id),safeName:input.safeName,sizeBytes:input.sizeBytes,scanStatus:input.scanStatus})})`;return String(rows[0].id)},
    async recordLeadAttachments(inputs){if(inputs.length===0)return[];return sql.begin(async(tx:any)=>{const ids:string[]=[];for(const input of inputs){const rows=await tx`INSERT INTO attachments(lead_id,storage_key,original_name,safe_name,mime,size_bytes,sha256,scan_status,delete_after) VALUES(${input.leadId},${input.storageKey},${input.originalName},${input.safeName},${input.mime},${input.sizeBytes},${input.sha256},${input.scanStatus},${input.deleteAfter}) RETURNING id`;const id=String(rows[0].id);ids.push(id);await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('system','attachment-store','attachment.created','lead',${input.leadId},${tx.json({attachmentId:id,safeName:input.safeName,sizeBytes:input.sizeBytes,scanStatus:input.scanStatus})})`}return ids})},
    async recordJobAttachment(input){const rows=await sql`INSERT INTO attachments(job_id,storage_key,original_name,safe_name,mime,size_bytes,sha256,scan_status,delete_after) VALUES(${input.jobId},${input.storageKey},${input.originalName},${input.safeName},${input.mime},${input.sizeBytes},${input.sha256},${input.scanStatus},${input.deleteAfter}) RETURNING id`;await sql`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('admin','attachment-store','proof.created','job',${input.jobId},${sql.json({attachmentId:String(rows[0].id),safeName:input.safeName,sizeBytes:input.sizeBytes,scanStatus:input.scanStatus})})`;return String(rows[0].id)},
    async getAttachmentForAdmin(id){const rows=await sql`SELECT * FROM attachments WHERE id=${id} LIMIT 1`;const row=rows[0];if(!row)return null;return{id:String(row.id),...(row.lead_id?{leadId:String(row.lead_id)}:{}),...(row.job_id?{jobId:String(row.job_id)}:{}),storageKey:String(row.storage_key),safeName:String(row.safe_name),originalName:String(row.original_name),mime:String(row.mime),sizeBytes:Number(row.size_bytes),sha256:String(row.sha256),scanStatus:String(row.scan_status),deleteAfter:new Date(row.delete_after).toISOString(),createdAt:new Date(row.created_at).toISOString()}},
    async getAttachmentForClient(id,telegramUserId){const rows=await sql`SELECT a.* FROM attachments a JOIN jobs j ON j.id=a.job_id JOIN leads l ON l.id=j.lead_id WHERE a.id=${id} AND l.telegram_user_id=${BigInt(telegramUserId)} AND j.status IN('awaiting_client_acceptance','completed') LIMIT 1`;const row=rows[0];if(!row)return null;return{id:String(row.id),jobId:String(row.job_id),storageKey:String(row.storage_key),safeName:String(row.safe_name),originalName:String(row.original_name),mime:String(row.mime),sizeBytes:Number(row.size_bytes),sha256:String(row.sha256),scanStatus:String(row.scan_status),deleteAfter:new Date(row.delete_after).toISOString(),createdAt:new Date(row.created_at).toISOString()}},
    async getCapacitySettings(){const rows=await sql`SELECT * FROM capacity_settings WHERE singleton=true LIMIT 1`;const row=rows[0];if(!row)throw new Error("CAPACITY_SETTINGS_MISSING");return{maximumActiveQuickFixes:Number(row.maximum_active_quick_fixes),maximumRescueJobs:Number(row.maximum_rescue_jobs),pauseCheckout:Boolean(row.pause_checkout),...(row.next_available_date?{nextAvailableDate:new Date(row.next_available_date).toISOString().slice(0,10)}:{}),workingHours:(row.working_hours??{}) as Record<string,unknown>,awayMode:Boolean(row.away_mode)}},
    async updateCapacitySettings(input,actor){await sql.begin(async(tx:any)=>{await tx`UPDATE capacity_settings SET maximum_active_quick_fixes=${input.maximumActiveQuickFixes},maximum_rescue_jobs=${input.maximumRescueJobs},pause_checkout=${input.pauseCheckout},next_available_date=${input.nextAvailableDate??null},working_hours=${tx.json(input.workingHours)},away_mode=${input.awayMode},updated_at=now() WHERE singleton=true`;await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('admin',${actor},'capacity.updated','settings','capacity',${tx.json(input)})`})},
    async listGroupMonitors(){const rows=await sql`SELECT * FROM group_monitors ORDER BY title,group_id`;return rows.map((row:any)=>({groupId:String(row.group_id),title:String(row.title),adminAuthorised:Boolean(row.admin_authorised),enabled:Boolean(row.enabled),minimumScore:Number(row.minimum_score),keywordCategories:Array.isArray(row.keyword_categories)?row.keyword_categories.map(String):[],...(row.quiet_hours?{quietHours:row.quiet_hours as Record<string,unknown>}:{}),responseMode:String(row.approved_response_mode) as GroupMonitorDetail["responseMode"],...(row.approved_template?{approvedTemplate:String(row.approved_template)}:{}),retentionDays:Number(row.retention_days),...(row.authorised_by?{authorisedBy:String(row.authorised_by)}:{}),...(row.authorised_at?{authorisedAt:new Date(row.authorised_at).toISOString()}:{})}))},
    async getGroupMonitor(groupId){const rows=await sql`SELECT * FROM group_monitors WHERE group_id=${BigInt(groupId)} LIMIT 1`;const row=rows[0];if(!row)return null;return{groupId:String(row.group_id),title:String(row.title),adminAuthorised:Boolean(row.admin_authorised),enabled:Boolean(row.enabled),minimumScore:Number(row.minimum_score),keywordCategories:Array.isArray(row.keyword_categories)?row.keyword_categories.map(String):[],...(row.quiet_hours?{quietHours:row.quiet_hours as Record<string,unknown>}:{}),responseMode:String(row.approved_response_mode) as GroupMonitorDetail["responseMode"],...(row.approved_template?{approvedTemplate:String(row.approved_template)}:{}),retentionDays:Number(row.retention_days),...(row.authorised_by?{authorisedBy:String(row.authorised_by)}:{}),...(row.authorised_at?{authorisedAt:new Date(row.authorised_at).toISOString()}:{})}},
    async upsertGroupMonitor(input,actor){if(input.enabled&&!input.adminAuthorised)throw new Error("GROUP_MONITOR_NOT_AUTHORISED");if(input.responseMode==="approved_template"&&!input.approvedTemplate?.trim())throw new Error("APPROVED_TEMPLATE_REQUIRED");if(input.keywordCategories.length===0)throw new Error("KEYWORD_CATEGORY_REQUIRED");await sql.begin(async(tx:any)=>{await tx`INSERT INTO group_monitors(group_id,title,admin_authorised,enabled,minimum_score,keyword_categories,quiet_hours,approved_response_mode,approved_template,retention_days,authorised_by,authorised_at) VALUES(${BigInt(input.groupId)},${input.title},${input.adminAuthorised},${input.enabled},${input.minimumScore},${tx.json(input.keywordCategories)},${input.quietHours?tx.json(input.quietHours):null},${input.responseMode},${input.approvedTemplate?.slice(0,1000)??null},${input.retentionDays},${input.adminAuthorised?(input.authorisedBy??actor):null},${input.adminAuthorised?(input.authorisedAt?new Date(input.authorisedAt):new Date()):null}) ON CONFLICT(group_id) DO UPDATE SET title=excluded.title,admin_authorised=excluded.admin_authorised,enabled=excluded.enabled,minimum_score=excluded.minimum_score,keyword_categories=excluded.keyword_categories,quiet_hours=excluded.quiet_hours,approved_response_mode=excluded.approved_response_mode,approved_template=excluded.approved_template,retention_days=excluded.retention_days,authorised_by=excluded.authorised_by,authorised_at=excluded.authorised_at`;await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('admin',${actor},'group_monitor.updated','group_monitor',${input.groupId},${tx.json({enabled:input.enabled,adminAuthorised:input.adminAuthorised,minimumScore:input.minimumScore,keywordCategories:input.keywordCategories,responseMode:input.responseMode,quietHours:input.quietHours??null})})`})},
    async recordDemandSignal(input){const rows=await sql`INSERT INTO demand_signals(group_id,message_id,excerpt,score,matched_categories,author_user_id,retained_until) VALUES(${BigInt(input.groupId)},${BigInt(input.messageId)},${input.excerpt.slice(0,1000)},${input.score},${sql.json(input.matchedCategories)},${input.authorUserId?BigInt(input.authorUserId):null},${input.retainedUntil}) ON CONFLICT(group_id,message_id) DO UPDATE SET score=excluded.score,matched_categories=excluded.matched_categories,retained_until=excluded.retained_until RETURNING id`;return String(rows[0].id)},
    async recordPartnerStart(slug,telegramUserId,campaign){const rows=await sql`SELECT id FROM partners WHERE slug=${slug} AND status='active' LIMIT 1`;if(!rows[0])return false;await sql`INSERT INTO partner_events(partner_id,event_type,telegram_user_id,campaign) VALUES(${rows[0].id},'telegram_start',${telegramUserId?BigInt(telegramUserId):null},${campaign?.slice(0,100)??null}) ON CONFLICT DO NOTHING`;return true},
    async claimTelegramUpdate(updateId,payloadDigest){const rows=await sql`INSERT INTO processed_telegram_updates(update_id,payload_digest,outcome) VALUES(${BigInt(updateId)},${payloadDigest},'received') ON CONFLICT(update_id) DO NOTHING RETURNING update_id`;return Boolean(rows[0])},
    async completeTelegramUpdate(updateId,outcome){await sql`UPDATE processed_telegram_updates SET processed_at=now(),outcome=${outcome.slice(0,100)} WHERE update_id=${BigInt(updateId)}`},
    async releaseTelegramUpdate(updateId){await sql`DELETE FROM processed_telegram_updates WHERE update_id=${BigInt(updateId)} AND processed_at IS NULL`},
    async listPartnerStats(){const rows=await sql`SELECT p.id,p.slug,p.name,p.commission_bps,p.status,p.owner_telegram_user_id,p.created_at,(SELECT COUNT(*)::int FROM partner_events pe WHERE pe.partner_id=p.id AND pe.event_type='telegram_start') telegram_starts,(SELECT COUNT(*)::int FROM leads l WHERE l.partner_id=p.id AND l.status NOT IN('new_lead','rejected')) qualified_leads,(SELECT COUNT(*)::int FROM jobs j JOIN leads l ON l.id=j.lead_id WHERE l.partner_id=p.id AND j.status IN('paid','in_progress','awaiting_client_acceptance','completed')) paid_jobs,(SELECT COALESCE(SUM(i.amount_minor),0)::text FROM invoices i JOIN quotes q ON q.id=i.quote_id JOIN leads l ON l.id=q.lead_id WHERE l.partner_id=p.id AND i.status='paid') collected_minor FROM partners p ORDER BY p.created_at DESC`;return rows.map((row:any)=>({id:String(row.id),slug:String(row.slug),name:String(row.name),commissionBps:Number(row.commission_bps),status:String(row.status) as PartnerStatsDetail["status"],...(row.owner_telegram_user_id?{ownerTelegramUserId:String(row.owner_telegram_user_id)}:{}),telegramStarts:Number(row.telegram_starts),qualifiedLeads:Number(row.qualified_leads),paidJobs:Number(row.paid_jobs),collectedMinor:String(row.collected_minor),createdAt:new Date(row.created_at).toISOString()}))},
    async createPartner(input,actor){if(!/^[a-z0-9_-]{2,64}$/.test(input.slug)||input.name.trim().length<2||input.name.length>200||!Number.isInteger(input.commissionBps)||input.commissionBps<0||input.commissionBps>5000||(input.ownerTelegramUserId&&!/^[0-9]{5,20}$/.test(input.ownerTelegramUserId)))throw new Error("INVALID_PARTNER");return sql.begin(async(tx:any)=>{const rows=await tx`INSERT INTO partners(slug,name,commission_bps,status,owner_telegram_user_id) VALUES(${input.slug},${input.name.trim()},${input.commissionBps},${input.status},${input.ownerTelegramUserId?BigInt(input.ownerTelegramUserId):null}) ON CONFLICT(slug) DO UPDATE SET name=excluded.name,commission_bps=excluded.commission_bps,status=excluded.status,owner_telegram_user_id=excluded.owner_telegram_user_id RETURNING id`;const id=String(rows[0].id);await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('admin',${actor},'partner.upserted','partner',${id},${tx.json({slug:input.slug,commissionBps:input.commissionBps,status:input.status,ownerTelegramUserId:input.ownerTelegramUserId??null})})`;return id})},
    async listReferralLedger(){const rows=await sql`SELECT r.id,p.slug,p.name,r.lead_id,r.status,r.commission_minor,r.manual_payout_status,r.fraud_flags,r.created_at FROM referrals r JOIN partners p ON p.id=r.partner_id ORDER BY r.created_at DESC`;return rows.map((row:any)=>({id:String(row.id),partnerSlug:String(row.slug),partnerName:String(row.name),leadId:String(row.lead_id),status:String(row.status),...(row.commission_minor!==null?{commissionMinor:String(row.commission_minor)}:{}),manualPayoutStatus:String(row.manual_payout_status),fraudFlags:Array.isArray(row.fraud_flags)?row.fraud_flags.map(String):[],createdAt:new Date(row.created_at).toISOString()}))},
    async updateReferralPayoutStatus(id,status,actor){return sql.begin(async(tx:any)=>{const current=await tx`SELECT id,status,manual_payout_status,commission_minor FROM referrals WHERE id=${id} FOR UPDATE`;if(!current[0])return false;if(status==='paid'&&(String(current[0].status)!=='eligible'||current[0].commission_minor===null))throw new Error("REFERRAL_NOT_PAYABLE");const rows=await tx`UPDATE referrals SET manual_payout_status=${status} WHERE id=${id} RETURNING id`;await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('admin',${actor},'referral.payout_status_changed','referral',${id},${tx.json({from:String(current[0].manual_payout_status),to:status})})`;return Boolean(rows[0])})},
    async createDeletionRequest(input){if(!input.telegramUserId&&!input.email)throw new Error("DELETION_IDENTITY_REQUIRED");const rows=await sql`INSERT INTO deletion_requests(telegram_user_id,email,notes) VALUES(${input.telegramUserId?BigInt(input.telegramUserId):null},${input.email??null},${input.notes??null}) RETURNING id`;return String(rows[0].id)},
    async listDeletionRequests(){const rows=await sql`SELECT * FROM deletion_requests ORDER BY CASE WHEN status='open' THEN 0 ELSE 1 END,requested_at DESC LIMIT 200`;return rows.map((row:any)=>({id:String(row.id),...(row.telegram_user_id?{telegramUserId:String(row.telegram_user_id)}:{}),...(row.email?{email:String(row.email)}:{}),status:String(row.status),requestedAt:new Date(row.requested_at).toISOString(),...(row.completed_at?{completedAt:new Date(row.completed_at).toISOString()}:{}),...(row.notes?{notes:String(row.notes)}:{})}))},
    async getDeletionWork(id){const rows=await sql`SELECT id,telegram_user_id,status FROM deletion_requests WHERE id=${id} LIMIT 1`;const request=rows[0];if(!request||String(request.status)!=='open'||!request.telegram_user_id)return null;const attachments=await sql`SELECT a.id,a.storage_key FROM attachments a LEFT JOIN leads l ON l.id=a.lead_id LEFT JOIN jobs j ON j.id=a.job_id LEFT JOIN leads jl ON jl.id=j.lead_id WHERE l.telegram_user_id=${request.telegram_user_id} OR jl.telegram_user_id=${request.telegram_user_id}`;return{requestId:String(request.id),telegramUserId:String(request.telegram_user_id),attachments:attachments.map((row:any)=>({id:String(row.id),storageKey:String(row.storage_key)}))}},
    async completeDeletionRequest(id,actor){return sql.begin(async(tx:any)=>{const requests=await tx`SELECT * FROM deletion_requests WHERE id=${id} FOR UPDATE`;const request=requests[0];if(!request)return false;if(String(request.status)==='completed')return true;if(String(request.status)!=='open'||!request.telegram_user_id)throw new Error("DELETION_REQUEST_NOT_READY");const telegramUserId=String(request.telegram_user_id);const leads=await tx`SELECT id,intake FROM leads WHERE telegram_user_id=${BigInt(telegramUserId)} FOR UPDATE`;for(const row of leads){const stored=row.intake as unknown;const intake=encrypted(stored)?decryptJson<Intake>(stored,dataEncryptionKey):stored as Intake;await tx`UPDATE leads SET telegram_user_id=NULL,telegram_username=NULL,intake=${tx.json(encryptJson(intakeAfterDeletion(intake),dataEncryptionKey))},internal_notes=NULL WHERE id=${row.id}`;await tx`UPDATE conversations SET body='[Deleted by user request]' WHERE lead_id=${row.id}`;await tx`UPDATE testimonial_requests tr SET response=NULL,permission_to_publish=false,status='deleted' FROM jobs j WHERE tr.job_id=j.id AND j.lead_id=${row.id}`;await tx`DELETE FROM attachments a USING jobs j WHERE a.job_id=j.id AND j.lead_id=${row.id}`;await tx`DELETE FROM attachments WHERE lead_id=${row.id}`}await tx`DELETE FROM partner_events WHERE telegram_user_id=${BigInt(telegramUserId)}`;await tx`UPDATE deletion_requests SET telegram_user_id=NULL,email=NULL,status='completed',completed_at=now(),notes='Completed after verified Telegram-bound request; personal intake and attachments removed or anonymised.' WHERE id=${id}`;await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('admin',${actor},'privacy.deletion_completed','deletion_request',${id},${tx.json({leadCount:leads.length,identityRemoved:true})})`;return true})},
    async addClientMessage(input){if(input.body.trim().length<1||input.body.length>4000)throw new Error("INVALID_MESSAGE");return sql.begin(async(tx:any)=>{const lead=await tx`SELECT id FROM leads WHERE id=${input.leadId} AND telegram_user_id=${BigInt(input.telegramUserId)} FOR UPDATE`;if(!lead[0])throw new Error("TICKET_NOT_FOUND");const rows=await tx`INSERT INTO conversations(lead_id,direction,body) VALUES(${input.leadId},'client',${input.body.trim()}) RETURNING id`;await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('client',${input.telegramUserId},'client.message_received','lead',${input.leadId},'{}')`;return String(rows[0].id)})},
    async addAdminMessage(input){if(input.body.trim().length<1||input.body.length>4000)throw new Error("INVALID_MESSAGE");return sql.begin(async(tx:any)=>{const lead=await tx`SELECT id FROM leads WHERE id=${input.leadId} FOR UPDATE`;if(!lead[0])throw new Error("TICKET_NOT_FOUND");const rows=await tx`INSERT INTO conversations(lead_id,direction,body) VALUES(${input.leadId},'jawad',${input.body.trim()}) RETURNING id`;await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('admin',${input.actor},'admin.message_sent','lead',${input.leadId},'{}')`;return String(rows[0].id)})},
    async acceptJob(input){return sql.begin(async(tx:any)=>{const rows=await tx`SELECT j.id,j.status,j.lead_id,j.invoice_id FROM jobs j JOIN leads l ON l.id=j.lead_id WHERE j.id=${input.jobId} AND l.telegram_user_id=${BigInt(input.telegramUserId)} FOR UPDATE OF j,l`;const job=rows[0];if(!job)throw new Error("JOB_NOT_FOUND");if(String(job.status)!=="awaiting_client_acceptance")throw new Error("JOB_NOT_AWAITING_ACCEPTANCE");await tx`UPDATE jobs SET status='completed',updated_at=now() WHERE id=${input.jobId}`;await tx`UPDATE leads SET status='completed',updated_at=now() WHERE id=${job.lead_id}`;if(input.feedback?.trim())await tx`INSERT INTO conversations(lead_id,direction,body) VALUES(${job.lead_id},'client',${input.feedback.trim().slice(0,4000)})`;await tx`INSERT INTO testimonial_requests(job_id,status) VALUES(${input.jobId},'requested') ON CONFLICT(job_id) DO NOTHING`;await tx`UPDATE referrals r SET status='eligible',commission_minor=(i.amount_minor*p.commission_bps/10000),manual_payout_status='pending_approval' FROM partners p,invoices i WHERE r.lead_id=${job.lead_id} AND r.partner_id=p.id AND i.id=${job.invoice_id}`;await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('client',${input.telegramUserId},'job.accepted','job',${input.jobId},'{}')`;return{ticketId:String(job.lead_id)}})},
    async submitTestimonial(input){return sql.begin(async(tx:any)=>{const rows=await tx`SELECT j.id,j.status FROM jobs j JOIN leads l ON l.id=j.lead_id WHERE j.id=${input.jobId} AND l.telegram_user_id=${BigInt(input.telegramUserId)} FOR UPDATE`;if(!rows[0])throw new Error("JOB_NOT_FOUND");if(String(rows[0].status)!=="completed")throw new Error("JOB_NOT_COMPLETED");const result=await tx`INSERT INTO testimonial_requests(job_id,status,response,permission_to_publish) VALUES(${input.jobId},'received',${input.response.slice(0,4000)},${input.permissionToPublish}) ON CONFLICT(job_id) DO UPDATE SET status='received',response=excluded.response,permission_to_publish=excluded.permission_to_publish RETURNING id`;await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('client',${input.telegramUserId},'testimonial.received','job',${input.jobId},${tx.json({permissionToPublish:input.permissionToPublish})})`;return String(result[0].id)})},
    async queueNotification(input){const rows=await sql`INSERT INTO notifications(kind,lead_id,job_id,recipient_chat_id,payload) VALUES(${input.kind},${input.leadId??null},${input.jobId??null},${BigInt(input.recipientChatId)},${sql.json(input.payload)}) RETURNING id`;return String(rows[0].id)},
    async listDueNotifications(limit=100){const rows=await sql`SELECT * FROM notifications WHERE status IN('queued','retry') AND next_attempt_at<=now() ORDER BY created_at LIMIT ${Math.max(1,Math.min(500,limit))}`;return rows.map((row:any)=>({id:String(row.id),kind:String(row.kind),recipientChatId:String(row.recipient_chat_id),...(row.lead_id?{leadId:String(row.lead_id)}:{}),...(row.job_id?{jobId:String(row.job_id)}:{}),payload:(row.payload??{}) as Record<string,unknown>,attempts:Number(row.attempts)}))},
    async markNotificationSent(id){await sql`UPDATE notifications SET status='sent',attempts=attempts+1,sent_at=now(),last_error=NULL WHERE id=${id}`},
    async markNotificationFailed(id,error,nextAttemptAt){await sql`UPDATE notifications SET status=CASE WHEN attempts>=4 THEN 'failed' ELSE 'retry' END,attempts=attempts+1,next_attempt_at=${nextAttemptAt},last_error=${error.slice(0,300)} WHERE id=${id}`},
    async listDueDeadlineReminders(limit=100){const rows=await sql`SELECT j.id,j.deadline FROM jobs j WHERE j.status IN('paid','in_progress') AND j.deadline IS NOT NULL AND j.deadline<=now()+interval '24 hours' AND NOT EXISTS(SELECT 1 FROM audit_log a WHERE a.entity_type='job' AND a.entity_id=j.id::text AND a.action='deadline.reminded' AND a.created_at>now()-interval '12 hours') ORDER BY j.deadline LIMIT ${Math.max(1,Math.min(500,limit))}`;return rows.map((row:any)=>({jobId:String(row.id),deadline:new Date(row.deadline).toISOString()}))},
    async markDeadlineReminded(jobId){await sql`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('system','deadline-worker','deadline.reminded','job',${jobId},'{}')`},
    async confirmPayment(input) {
      return sql.begin(async(tx:any)=>{
        const rows=await tx`SELECT i.*,q.lead_id,q.scope,q.acceptance_test,q.delivery_window FROM invoices i JOIN quotes q ON q.id=i.quote_id WHERE i.id=${input.invoiceId} FOR UPDATE`;const invoice=rows[0];if(!invoice)throw new Error("INVOICE_NOT_FOUND");
        if(String(invoice.status)==="paid"){const job=await tx`SELECT id FROM jobs WHERE invoice_id=${input.invoiceId}`;if(String(invoice.tx_hash)===input.transfer.txHash&&job[0])return{invoiceId:input.invoiceId,jobId:String(job[0].id),code:"ALREADY_PAID_IDEMPOTENT" as const};throw new Error("INVOICE_ALREADY_PAID")}
        const failure:string[]=[];if(new Date(invoice.expires_at).getTime()<Date.now())failure.push("INVOICE_EXPIRED");if(input.transfer.network!==invoice.network)failure.push("WRONG_NETWORK");if(!input.transfer.success)failure.push("FAILED_TRANSACTION");if(input.transfer.tokenContract.toLowerCase()!==String(invoice.token_contract).toLowerCase())failure.push("WRONG_TOKEN");if(input.transfer.to.toLowerCase()!==String(invoice.recipient_address).toLowerCase())failure.push("WRONG_RECIPIENT");if(input.transfer.amountMinor<BigInt(invoice.amount_minor))failure.push("INSUFFICIENT_AMOUNT");if(input.transfer.confirmations<input.minConfirmations)failure.push("INSUFFICIENT_CONFIRMATIONS");if(failure.length){await tx`INSERT INTO payment_verification_attempts(invoice_id,tx_hash,provider,outcome,evidence) VALUES(${input.invoiceId},${input.transfer.txHash},${input.actor},${failure[0]},${tx.json({...input.transfer,amountMinor:input.transfer.amountMinor.toString(),failures:failure})})`;throw new Error(failure[0])}
        const reused=await tx`SELECT invoice_id FROM payment_assignments WHERE tx_hash=${input.transfer.txHash}`;if(reused[0]&&String(reused[0].invoice_id)!==input.invoiceId)throw new Error("DUPLICATE_TX_HASH");
        const evidence={...input.transfer,amountMinor:input.transfer.amountMinor.toString()};const assigned=await tx`INSERT INTO payment_assignments(tx_hash,invoice_id,network,evidence) VALUES(${input.transfer.txHash},${input.invoiceId},${input.transfer.network},${tx.json(evidence)}) ON CONFLICT(tx_hash) DO NOTHING RETURNING invoice_id`;if(!assigned[0]){const winner=await tx`SELECT invoice_id FROM payment_assignments WHERE tx_hash=${input.transfer.txHash}`;if(!winner[0]||String(winner[0].invoice_id)!==input.invoiceId)throw new Error("DUPLICATE_TX_HASH")}
        await tx`UPDATE invoices SET status='paid',tx_hash=${input.transfer.txHash},paid_at=now(),reference_usd_minor=COALESCE(${input.referenceUsdMinor??null},reference_usd_minor) WHERE id=${input.invoiceId}`;
        const jobs=await tx`INSERT INTO jobs(lead_id,invoice_id,status,scope,acceptance_test,deadline) VALUES(${invoice.lead_id},${input.invoiceId},'paid',${invoice.scope},${invoice.acceptance_test},now()+interval '7 days') ON CONFLICT(invoice_id) DO UPDATE SET updated_at=now() RETURNING id`;
        const jobId=String(jobs[0].id);await tx`UPDATE leads SET status='paid' WHERE id=${invoice.lead_id}`;await tx`INSERT INTO payment_verification_attempts(invoice_id,tx_hash,provider,outcome,evidence) VALUES(${input.invoiceId},${input.transfer.txHash},${input.actor},'PAYMENT_CONFIRMED',${tx.json(evidence)})`;await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('system',${input.actor},'payment.confirmed','invoice',${input.invoiceId},${tx.json({jobId,txHash:input.transfer.txHash})})`;return{invoiceId:input.invoiceId,jobId,code:"PAYMENT_CONFIRMED" as const};
      });
    },
    async manualConfirmPayment(input){if(input.reason.trim().length<20||input.reason.length>2000)throw new Error("MANUAL_OVERRIDE_REASON_REQUIRED");return sql.begin(async(tx:any)=>{const current=await tx`SELECT i.*,q.lead_id,q.scope,q.acceptance_test FROM invoices i JOIN quotes q ON q.id=i.quote_id WHERE i.id=${input.invoiceId} FOR UPDATE OF i`;const invoice=current[0];if(!invoice)throw new Error("INVOICE_NOT_FOUND");if(invoice.status==='paid'){const jobs=await tx`SELECT id FROM jobs WHERE invoice_id=${input.invoiceId} LIMIT 1`;if(!jobs[0])throw new Error("PAID_INVOICE_JOB_MISSING");return{invoiceId:input.invoiceId,jobId:String(jobs[0].id),code:"ALREADY_PAID_IDEMPOTENT" as const}}if(!['open','expired','ambiguous','manual_review'].includes(String(invoice.status)))throw new Error("INVOICE_NOT_MANUALLY_CONFIRMABLE");const canonical=String(invoice.network)==='BASE_USDC'?input.txHash.toLowerCase():input.txHash.replace(/^0x/i,'').toLowerCase();const valid=String(invoice.network)==='BASE_USDC'?/^0x[0-9a-f]{64}$/.test(canonical):/^[0-9a-f]{64}$/.test(canonical);if(!valid)throw new Error("INVALID_TRANSACTION_HASH");const evidence={manualOverride:true,assertion:"HUMAN_REVIEWED_OUTSIDE_AUTOMATIC_PROVIDER",reason:input.reason.trim(),actor:input.actor,recordedAt:new Date().toISOString()};const assigned=await tx`INSERT INTO payment_assignments(tx_hash,invoice_id,network,evidence) VALUES(${canonical},${input.invoiceId},${invoice.network},${tx.json(evidence)}) ON CONFLICT(tx_hash) DO NOTHING RETURNING invoice_id`;if(!assigned[0]){const winner=await tx`SELECT invoice_id FROM payment_assignments WHERE tx_hash=${canonical}`;if(!winner[0]||String(winner[0].invoice_id)!==input.invoiceId)throw new Error("DUPLICATE_TX_HASH")}await tx`UPDATE invoices SET status='paid',tx_hash=${canonical},paid_at=now(),reference_usd_minor=COALESCE(reference_usd_minor,amount_minor/10000) WHERE id=${input.invoiceId}`;const jobs=await tx`INSERT INTO jobs(lead_id,invoice_id,status,scope,acceptance_test,deadline) VALUES(${invoice.lead_id},${input.invoiceId},'paid',${invoice.scope},${invoice.acceptance_test},now()+interval '7 days') ON CONFLICT(invoice_id) DO UPDATE SET updated_at=now() RETURNING id`;const jobId=String(jobs[0].id);await tx`UPDATE leads SET status='paid' WHERE id=${invoice.lead_id}`;await tx`INSERT INTO payment_verification_attempts(invoice_id,tx_hash,provider,outcome,evidence) VALUES(${input.invoiceId},${canonical},${`manual:${input.actor}`},'PAYMENT_CONFIRMED_MANUAL_OVERRIDE',${tx.json(evidence)})`;await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('admin',${input.actor},'payment.manual_override','invoice',${input.invoiceId},${tx.json({jobId,txHash:canonical,reason:input.reason.trim()})})`;return{invoiceId:input.invoiceId,jobId,code:"PAYMENT_CONFIRMED" as const}})},
    async recordVerificationFailure(invoiceId,txHash,provider,outcome,evidence){await sql`INSERT INTO payment_verification_attempts(invoice_id,tx_hash,provider,outcome,evidence) VALUES(${invoiceId},${txHash},${provider},${outcome},${sql.json(evidence)})`},
    async getJob(id){const rows=await sql`SELECT j.*,l.intake FROM jobs j JOIN leads l ON l.id=j.lead_id WHERE j.id=${id} LIMIT 1`;const row=rows[0];if(!row)return null;const storedIntake=row.intake as unknown;const intake=encrypted(storedIntake)?decryptJson<Intake>(storedIntake,dataEncryptionKey):storedIntake as Intake;const attachmentRows=await sql`SELECT * FROM attachments WHERE job_id=${id} ORDER BY created_at DESC`;const attachments=attachmentRows.map((attachment:any)=>({id:String(attachment.id),jobId:String(attachment.job_id),storageKey:String(attachment.storage_key),safeName:String(attachment.safe_name),originalName:String(attachment.original_name),mime:String(attachment.mime),sizeBytes:Number(attachment.size_bytes),sha256:String(attachment.sha256),scanStatus:String(attachment.scan_status),deleteAfter:new Date(attachment.delete_after).toISOString(),createdAt:new Date(attachment.created_at).toISOString()}));return{id:String(row.id),leadId:String(row.lead_id),status:String(row.status),scope:String(row.scope),acceptanceTest:(row.acceptance_test??[]) as string[],accessChecklist:(row.access_checklist??[]) as string[],reproduction:intake.reproductionSteps,proof:(row.proof??[]) as unknown[],testResults:(row.test_results??[]) as unknown[],attachments,...(row.delivery_message?{deliveryMessage:String(row.delivery_message)}:{}),...(row.internal_notes?{internalNotes:String(row.internal_notes)}:{}),...(row.deadline?{deadline:new Date(row.deadline).toISOString()}:{}),createdAt:new Date(row.created_at).toISOString()}},
    async getLeadTelegramTarget(id){const rows=await sql`SELECT telegram_user_id FROM leads WHERE id=${id} LIMIT 1`;return rows[0]?.telegram_user_id?{telegramUserId:String(rows[0].telegram_user_id),ticketId:id}:null},
    async getJobTelegramTarget(id){const rows=await sql`SELECT l.telegram_user_id,l.id lead_id FROM jobs j JOIN leads l ON l.id=j.lead_id WHERE j.id=${id} LIMIT 1`;return rows[0]?.telegram_user_id?{telegramUserId:String(rows[0].telegram_user_id),ticketId:String(rows[0].lead_id)}:null},
    async updateJobStatus(id,status,actor,input={}){const allowed:Record<string,string[]>={paid:["in_progress","refunded"],in_progress:["awaiting_client_acceptance","refunded"],awaiting_client_acceptance:["completed","in_progress","refunded"],completed:[],refunded:[]};return sql.begin(async(tx:any)=>{const current=await tx`SELECT status,lead_id,invoice_id FROM jobs WHERE id=${id} FOR UPDATE`;if(!current[0])return false;const from=String(current[0].status);if(!allowed[from]?.includes(status))throw new Error("ILLEGAL_JOB_TRANSITION");const updated=await tx`UPDATE jobs SET status=${status},delivery_message=COALESCE(${input.deliveryMessage??null},delivery_message),proof=COALESCE(${input.proof?tx.json(input.proof):null},proof),test_results=COALESCE(${input.testResults?tx.json(input.testResults):null},test_results),updated_at=now() WHERE id=${id} RETURNING id`;await tx`UPDATE leads SET status=${status},updated_at=now() WHERE id=${current[0].lead_id}`;if(status==="completed"){await tx`INSERT INTO testimonial_requests(job_id,status) VALUES(${id},'requested') ON CONFLICT(job_id) DO NOTHING`;await tx`UPDATE referrals r SET status='eligible',commission_minor=(i.amount_minor*p.commission_bps/10000),manual_payout_status='pending_approval' FROM partners p,invoices i WHERE r.lead_id=${current[0].lead_id} AND r.partner_id=p.id AND i.id=${current[0].invoice_id}`}if(status==="refunded")await tx`UPDATE referrals SET status='cancelled',commission_minor=NULL,manual_payout_status='not_eligible' WHERE lead_id=${current[0].lead_id}`;await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('admin',${actor},'job.status_changed','job',${id},${tx.json({from,status})})`;return Boolean(updated[0])})},
    async updateJobDetails(id,actor,input){if(input.accessChecklist.length>50)throw new Error("ACCESS_CHECKLIST_LIMIT");if(input.internalNotes&&input.internalNotes.length>12000)throw new Error("INTERNAL_NOTES_LIMIT");return sql.begin(async(tx:any)=>{const rows=await tx`UPDATE jobs SET access_checklist=${tx.json(input.accessChecklist)},internal_notes=${input.internalNotes?.trim()||null},deadline=${input.deadline??null},updated_at=now() WHERE id=${id} RETURNING id`;if(rows[0])await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('admin',${actor},'job.details_updated','job',${id},${tx.json({accessChecklistCount:input.accessChecklist.length,deadline:input.deadline?.toISOString()??null,internalNotesPresent:Boolean(input.internalNotes?.trim())})})`;return Boolean(rows[0])})},
    async updateLeadStatus(id,status,actor,reason){const rows=await sql.begin(async(tx:any)=>{const updated=await tx`UPDATE leads SET status=${status},internal_notes=COALESCE(${reason??null},internal_notes) WHERE id=${id} RETURNING id`;if(updated[0])await tx`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('admin',${actor},'lead.status_changed','lead',${id},${tx.json({status,reason:reason??null})})`;return updated});return Boolean(rows[0])},
    async close(){await sql.end({timeout:5})},
  };
}
