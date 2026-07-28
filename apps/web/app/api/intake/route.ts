import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isDemoMode } from "@jawad/config";
import { createPostgresRepository } from "@jawad/database";
import { parseAttribution,type Intake,type IntakeKind } from "@jawad/domain";
import { qualify } from "@jawad/qualification";
import { validateTelegramInitData } from "@jawad/telegram";
import { HttpBodyError,readJsonBody } from "../../../lib/http";
import { allowRequest,requestAddress } from "../../../lib/rate-limit";

const kinds=new Set<IntakeKind>(["quick-fix","agency-overflow","production-rescue"]);
function text(value:unknown,max:number){return String(value??"").trim().slice(0,max)}
function textArray(value:unknown,maxItems=30,maxLength=500){return Array.isArray(value)?value.map(item=>text(item,maxLength)).filter(Boolean).slice(0,maxItems):[]}
function optionalText(value:unknown,max:number){const v=text(value,max);return v||undefined}
function safeIntake(input:unknown,allowUntrustedReferral=false):Intake{
  if(!input||typeof input!=="object")throw new Error("INVALID_INTAKE");
  const x=input as Record<string,unknown>;
  const kind=String(x.kind??"") as IntakeKind;
  const name=text(x.name,100);
  const company=optionalText(x.company,120);
  const stack=textArray(x.stack,20,80);
  const brokenBehaviour=text(x.brokenBehaviour,4000);
  const expectedBehaviour=text(x.expectedBehaviour,4000);
  const reproductionSteps=textArray(x.reproductionSteps,30,500);
  if(!kinds.has(kind)||!name||!stack.length||!brokenBehaviour||!expectedBehaviour||!reproductionSteps.length||x.ownershipConfirmed!==true)throw new Error("MISSING_REQUIRED_FIELDS");
  const errorMessage=optionalText(x.errorMessage,3000);
  const deadline=optionalText(x.deadline,200);
  const budget=optionalText(x.budget,200);
  const recentChange=optionalText(x.recentChange,3000);
  const safePreview=JSON.stringify({name,stack,brokenBehaviour,expectedBehaviour,reproductionSteps,errorMessage,recentChange});
  if(/password\s*[=:]|seed phrase|private key|\.env\b|authorization:\s*bearer|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i.test(safePreview))throw new Error("POTENTIAL_SECRET");
  const environmentValue=String(x.environment??"");
  const environment=environmentValue==="local"||environmentValue==="staging"||environmentValue==="production"?environmentValue:undefined;
  const estimated=Number(x.estimatedMinutes);
  const users=Number(x.usersAffected);
  const acceptanceCriteria=textArray(x.acceptanceCriteria);
  const referral=allowUntrustedReferral?text(x.referralSlug,64).replace(/[^a-zA-Z0-9_-]/g,""):"";
  return {
    id:randomUUID(),kind,name,...(company?{company}:{}),stack,...(environment?{environment}:{}),brokenBehaviour,expectedBehaviour,reproductionSteps,
    ...(errorMessage?{errorMessage}:{}),...(deadline?{deadline}:{}),...(budget?{budget}:{}),ownershipConfirmed:true,
    ...(typeof x.approvedAndFunded==="boolean"?{approvedAndFunded:x.approvedAndFunded}:{}),
    ...(typeof x.productionDown==="boolean"?{productionDown:x.productionDown}:{}),
    ...(Number.isSafeInteger(users)&&users>=0&&users<=1_000_000_000?{usersAffected:users}:{}),
    ...(recentChange?{recentChange}:{}),
    ...(typeof x.safeRollbackAvailable==="boolean"?{safeRollbackAvailable:x.safeRollbackAvailable}:{}),
    ...(acceptanceCriteria.length?{acceptanceCriteria}:{}),
    ...(typeof x.requiresNewMajorIntegration==="boolean"?{requiresNewMajorIntegration:x.requiresNewMajorIntegration}:{}),
    ...(typeof x.requiresRedesign==="boolean"?{requiresRedesign:x.requiresRedesign}:{}),
    ...(Number.isFinite(estimated)&&estimated>=15&&estimated<=10_000?{estimatedMinutes:Math.round(estimated)}:{}),
    ...(typeof x.requiredAccessAvailable==="boolean"?{requiredAccessAvailable:x.requiredAccessAvailable}:{}),
    ...(typeof x.securityIncident==="boolean"?{securityIncident:x.securityIncident}:{}),
    ...(typeof x.asksJawadToPayFirst==="boolean"?{asksJawadToPayFirst:x.asksJawadToPayFirst}:{}),
    ...(typeof x.unsafeRequest==="boolean"?{unsafeRequest:x.unsafeRequest}:{}),
    ...(referral?{referralSlug:referral}:{})
  };
}

export async function POST(request:Request){
  try{
    const demo=isDemoMode();
    let telegramUser:{id:string;username?:string}|undefined;
    let authenticatedStartParam:string|undefined;
    if(!demo){
      const token=process.env.TELEGRAM_BOT_TOKEN;
      if(!token)return NextResponse.json({error:"BOT_NOT_CONFIGURED"},{status:503});
      const valid=validateTelegramInitData(request.headers.get("x-telegram-init-data")??"",token);
      if(!valid.ok||!valid.user?.id)return NextResponse.json({error:"INVALID_TELEGRAM_IDENTITY",reason:valid.reason},{status:401});
      telegramUser=valid.user;
      authenticatedStartParam=valid.startParam;
    }
    const limiter=await allowRequest("intake",telegramUser?.id??requestAddress(request));
    if(!limiter.allowed)return NextResponse.json({error:"RATE_LIMITED",retryAfterMs:limiter.retryAfterMs},{status:429});
    const payload=await readJsonBody<unknown>(request,128_000);
    const intake=safeIntake(payload,demo);
    const result=qualify(intake);
    const status=result.recommendedPackage==="REJECT"?"rejected":result.missingInformation.length?"awaiting_information":"awaiting_review";
    const attribution=parseAttribution(demo&&intake.referralSlug?`partner_${intake.referralSlug}`:authenticatedStartParam??"direct");
    if(demo)return NextResponse.json({id:`demo-${randomUUID()}`,status,qualification:result,manualApprovalRequired:true},{status:201});
    if(!process.env.DATABASE_URL||!process.env.DATA_ENCRYPTION_KEY)return NextResponse.json({error:"DATABASE_NOT_CONFIGURED"},{status:503});
    const repository=await createPostgresRepository(process.env.DATABASE_URL,process.env.DATA_ENCRYPTION_KEY);
    try{
      const id=await repository.createLead({...(telegramUser?.id?{telegramUserId:telegramUser.id}:{}),...(telegramUser?.username?{telegramUsername:telegramUser.username}:{}),intake,qualification:result,attributionSource:attribution.source,...(attribution.partnerSlug?{partnerSlug:attribution.partnerSlug}:{}),status});
      return NextResponse.json({id,status,qualification:result,manualApprovalRequired:true},{status:201});
    }finally{await repository.close()}
  }catch(error){
    if(error instanceof HttpBodyError)return NextResponse.json({error:error.code},{status:error.status});
    const code=error instanceof Error?error.message:"INVALID_REQUEST";
    return NextResponse.json({error:code},{status:["MISSING_REQUIRED_FIELDS","POTENTIAL_SECRET","INVALID_INTAKE"].includes(code)?422:400});
  }
}
