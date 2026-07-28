import { cookies } from "next/headers";
import { createPostgresRepository, type DashboardSnapshot, type LeadDetail, type JobDetail, type CapacitySettingsDetail, type GroupMonitorDetail, type PartnerStatsDetail, type ReferralLedgerDetail, type DeletionRequestDetail } from "@jawad/database";
import { verifyAdminSession, type AdminSession } from "@jawad/security";

export const SESSION_COOKIE = "jawad_admin_session";
export const CSRF_COOKIE = "jawad_csrf";

export async function currentAdmin(): Promise<{ session: AdminSession; csrf: string } | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  const session = verifyAdminSession(token, secret);
  const csrf = store.get(CSRF_COOKIE)?.value;
  return session && csrf ? { session, csrf } : null;
}

function demoSnapshot(): DashboardSnapshot {
  return {
    counts: { new_lead: 1, awaiting_review: 1, awaiting_payment: 1, paid: 1, in_progress: 1, completed: 1 },
    leads: [
      { id: "demo-quick-fix", status: "awaiting_review", intakeKind: "quick_fix", telegramUsername: "demo_client", attributionSource: "partner_demo-agency", createdAt: new Date().toISOString() },
      { id: "demo-paid-job", status: "paid", intakeKind: "production_rescue", attributionSource: "direct", createdAt: new Date(Date.now() - 3_600_000).toISOString() },
    ],
  };
}

export async function loadDashboard(): Promise<{ snapshot: DashboardSnapshot; source: "database" | "demo" | "degraded"; error?: string }> {
  if ((process.env.DEMO_MODE ?? "true") === "true") return { snapshot: demoSnapshot(), source: "demo" };
  if (!process.env.DATABASE_URL || !process.env.DATA_ENCRYPTION_KEY) return { snapshot: demoSnapshot(), source: "degraded", error: "Database or encryption configuration is missing." };
  const repository = await createPostgresRepository(process.env.DATABASE_URL, process.env.DATA_ENCRYPTION_KEY);
  try { return { snapshot: await repository.dashboard(), source: "database" }; }
  catch (error) { return { snapshot: demoSnapshot(), source: "degraded", error: error instanceof Error ? error.message : "Database unavailable" }; }
  finally { await repository.close(); }
}

export async function loadLead(id: string): Promise<LeadDetail | null> {
  if ((process.env.DEMO_MODE ?? "true") === "true") {
    if (!id.startsWith("demo-")) return null;
    return {
      id,
      status: id.includes("paid") ? "paid" : "awaiting_review",
      intakeKind: id.includes("paid") ? "production_rescue" : "quick_fix",
      telegramUsername: "demo_client",
      attributionSource: "partner_demo-agency",
      createdAt: new Date().toISOString(),
      attachments: [],
      conversation: [],
      intake: {
        id,
        kind: id.includes("paid") ? "production-rescue" : "quick-fix",
        name: "Synthetic Demo Client",
        company: "Demo Agency",
        stack: ["Next.js", "Node.js", "PostgreSQL"],
        environment: "staging",
        brokenBehaviour: "Checkout returns a safe synthetic error.",
        expectedBehaviour: "A test order should be created once.",
        reproductionSteps: ["Open checkout", "Submit the synthetic test order"],
        ownershipConfirmed: true,
        requiredAccessAvailable: true,
        estimatedMinutes: 75,
      },
    };
  }
  if (!process.env.DATABASE_URL || !process.env.DATA_ENCRYPTION_KEY) return null;
  const repository = await createPostgresRepository(process.env.DATABASE_URL, process.env.DATA_ENCRYPTION_KEY);
  try { return await repository.getLead(id); }
  finally { await repository.close(); }
}

export async function loadJob(id:string):Promise<JobDetail|null>{
  if((process.env.DEMO_MODE??"true")==="true")return{id,leadId:"demo-paid-job",status:"paid",scope:"Repair the synthetic checkout defect",acceptanceTest:["Test order is created once"],accessChecklist:["Repository access approved","Staging only"],reproduction:["Open checkout","Submit the synthetic test order"],proof:[],testResults:[],deadline:new Date(Date.now()+86400000).toISOString(),createdAt:new Date().toISOString()};
  if(!process.env.DATABASE_URL||!process.env.DATA_ENCRYPTION_KEY)return null;const repository=await createPostgresRepository(process.env.DATABASE_URL,process.env.DATA_ENCRYPTION_KEY);try{return await repository.getJob(id)}finally{await repository.close()}
}

export async function loadOperations():Promise<{capacity:CapacitySettingsDetail;groups:GroupMonitorDetail[];source:"database"|"demo"|"degraded";error?:string}>{
  const demoCapacity:CapacitySettingsDetail={maximumActiveQuickFixes:2,maximumRescueJobs:1,pauseCheckout:false,workingHours:{timezone:"Asia/Beirut",days:["Monday","Tuesday","Wednesday","Thursday","Friday"]},awayMode:false};
  if((process.env.DEMO_MODE??"true")==="true")return{capacity:demoCapacity,groups:[{groupId:"-100000000001",title:"Authorised demo group",adminAuthorised:true,enabled:true,minimumScore:6,keywordCategories:["developer_request","react_next","node_api","production_deployment","database_auth","urgent_today","unfinished_handoff"],responseMode:"notify_only",retentionDays:30,authorisedBy:"demo-admin",authorisedAt:new Date().toISOString()}],source:"demo"};
  if(!process.env.DATABASE_URL||!process.env.DATA_ENCRYPTION_KEY)return{capacity:demoCapacity,groups:[],source:"degraded",error:"Database or encryption configuration is missing."};
  const repository=await createPostgresRepository(process.env.DATABASE_URL,process.env.DATA_ENCRYPTION_KEY);try{return{capacity:await repository.getCapacitySettings(),groups:await repository.listGroupMonitors(),source:"database"}}catch(error){return{capacity:demoCapacity,groups:[],source:"degraded",error:error instanceof Error?error.message:"Operations settings unavailable"}}finally{await repository.close()}
}

export async function loadPartners():Promise<{partners:PartnerStatsDetail[];referrals:ReferralLedgerDetail[];source:"database"|"demo"|"degraded";error?:string}>{
  const partners:PartnerStatsDetail[]=[{id:"demo-partner",slug:"demo-agency",name:"Demo Agency",commissionBps:2000,status:"active",ownerTelegramUserId:"999001",telegramStarts:4,qualifiedLeads:2,paidJobs:1,collectedMinor:"100000000",createdAt:new Date().toISOString()}];
  const referrals:ReferralLedgerDetail[]=[{id:"demo-referral",partnerSlug:"demo-agency",partnerName:"Demo Agency",leadId:"demo-quick-fix",status:"eligible",commissionMinor:"20000000",manualPayoutStatus:"pending_approval",fraudFlags:[],createdAt:new Date().toISOString()}];
  if((process.env.DEMO_MODE??"true")==="true")return{partners,referrals,source:"demo"};
  if(!process.env.DATABASE_URL||!process.env.DATA_ENCRYPTION_KEY)return{partners:[],referrals:[],source:"degraded",error:"Database or encryption configuration is missing."};
  const repository=await createPostgresRepository(process.env.DATABASE_URL,process.env.DATA_ENCRYPTION_KEY);try{return{partners:await repository.listPartnerStats(),referrals:await repository.listReferralLedger(),source:"database"}}catch(error){return{partners:[],referrals:[],source:"degraded",error:error instanceof Error?error.message:"Partner operations unavailable"}}finally{await repository.close()}
}
export async function loadPrivacyRequests():Promise<{requests:DeletionRequestDetail[];source:"database"|"demo"|"degraded";error?:string}>{const demo:DeletionRequestDetail[]=[{id:"demo-deletion",telegramUserId:"999000001",status:"open",requestedAt:new Date().toISOString(),notes:"Synthetic deletion request"}];if((process.env.DEMO_MODE??"true")==="true")return{requests:demo,source:"demo"};if(!process.env.DATABASE_URL||!process.env.DATA_ENCRYPTION_KEY)return{requests:[],source:"degraded",error:"Database or encryption configuration is missing."};const repository=await createPostgresRepository(process.env.DATABASE_URL,process.env.DATA_ENCRYPTION_KEY);try{return{requests:await repository.listDeletionRequests(),source:"database"}}catch(error){return{requests:[],source:"degraded",error:error instanceof Error?error.message:"Privacy requests unavailable"}}finally{await repository.close()}}
