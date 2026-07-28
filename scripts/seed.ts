import { mkdir,writeFile } from "node:fs/promises";
import { createPostgresRepository } from "../packages/database/src/index.ts";
import { qualify } from "../packages/qualification/src/index.ts";
import type { Intake } from "../packages/domain/src/index.ts";

const root=new URL("..",import.meta.url).pathname;
const fixture={partner:{slug:"demo-agency",commissionPercent:20},client:{name:"Synthetic Demo Client"},submission:{kind:"quick-fix",status:"awaiting_review"},notice:"Synthetic local demo data; never present as a real client, payment, testimonial, or job."};
await mkdir(`${root}runtime`,{recursive:true});await writeFile(`${root}runtime/demo-seed.json`,JSON.stringify(fixture,null,2));
if(process.env.SEED_DATABASE!=="true"){console.log("Demo seed file PASS; database seed disabled unless SEED_DATABASE=true");process.exit(0)}
const databaseUrl=process.env.DATABASE_URL;const encryptionKey=process.env.DATA_ENCRYPTION_KEY;if(!databaseUrl||!encryptionKey)throw new Error("DATABASE_URL_AND_DATA_ENCRYPTION_KEY_REQUIRED_FOR_DATABASE_SEED");
const module=await import("postgres") as any;const postgres=module.default??module;const sql=postgres(databaseUrl,{max:1,prepare:true});
try{
  const existing=await sql`SELECT value FROM system_settings WHERE key='synthetic_demo_seed_v1' LIMIT 1`;if(existing[0]){console.log("Database seed SKIP synthetic_demo_seed_v1 already applied");process.exitCode=0}else{
    const repository=await createPostgresRepository(databaseUrl,encryptionKey);try{
      await repository.createPartner({slug:"demo-agency",name:"Synthetic Demo Agency",commissionBps:2000,status:"active",ownerTelegramUserId:"999000002"},"database-seed");
      const intake:Intake={id:"synthetic-seed-intake",kind:"quick-fix",name:"Synthetic Demo Client",company:"Synthetic Demo Agency",contactPreference:"Telegram only",applicationUrl:"https://example.invalid/synthetic-demo",stack:["Next.js","Node.js","PostgreSQL"],environment:"staging",brokenBehaviour:"A synthetic checkout fixture returns a controlled error.",expectedBehaviour:"One synthetic order is created exactly once.",reproductionSteps:["Open the synthetic checkout fixture","Submit the non-production test order"],errorMessage:"SYNTHETIC_CHECKOUT_ERROR",deadline:"No real deadline",budget:"100 USDT test fixture",ownershipConfirmed:true,requiredAccessAvailable:true,accessMethodPreference:"Synthetic staging fixture only",estimatedMinutes:75};
      const leadId=await repository.createLead({telegramUserId:"999000001",telegramUsername:"synthetic_seed_client",intake,qualification:qualify(intake),attributionSource:"partner_demo-agency",partnerSlug:"demo-agency",status:"awaiting_review"});
      await sql`INSERT INTO system_settings(key,value,sensitive) VALUES('synthetic_demo_seed_v1',${sql.json({leadId,partnerSlug:"demo-agency",synthetic:true})},false)`;
      console.log(JSON.stringify({ok:true,seed:"synthetic_demo_seed_v1",leadId,containsRealClientData:false}));
    }finally{await repository.close()}
  }
}finally{await sql.end({timeout:5})}
