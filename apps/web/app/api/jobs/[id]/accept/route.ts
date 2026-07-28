import { NextResponse } from "next/server";
import { isDemoMode } from "@jawad/config";
import { createPostgresRepository } from "@jawad/database";
import { HttpBodyError,readJsonBody } from "../../../../../lib/http";
import { telegramClient } from "../../../../../lib/telegram-client";
import { allowRequest } from "../../../../../lib/rate-limit";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const client=telegramClient(request);if(!client)return NextResponse.json({error:"INVALID_TELEGRAM_IDENTITY"},{status:401});
  const limit=await allowRequest("job-accept",client.id);if(!limit.allowed)return NextResponse.json({error:"RATE_LIMITED",retryAfterMs:limit.retryAfterMs},{status:429});
  let body:{feedback?:string};try{body=await readJsonBody(request,8_000)}catch(error){if(error instanceof HttpBodyError)return NextResponse.json({error:error.code},{status:error.status});return NextResponse.json({error:"INVALID_REQUEST"},{status:400})}
  const feedback=String(body.feedback??"").trim();if(feedback.length>4000)return NextResponse.json({error:"FEEDBACK_TOO_LONG"},{status:422});const {id}=await params;
  if(isDemoMode())return NextResponse.json({ticketId:"demo-paid-job",status:"completed",demo:true});
  if(!process.env.DATABASE_URL||!process.env.DATA_ENCRYPTION_KEY)return NextResponse.json({error:"DATABASE_NOT_CONFIGURED"},{status:503});
  const repo=await createPostgresRepository(process.env.DATABASE_URL,process.env.DATA_ENCRYPTION_KEY);
  try{const result=await repo.acceptJob({jobId:id,telegramUserId:client.id,...(feedback?{feedback}:{})});if(process.env.TELEGRAM_ADMIN_CHAT_ID)await repo.queueNotification({kind:"Client accepted delivery",recipientChatId:process.env.TELEGRAM_ADMIN_CHAT_ID,jobId:id,leadId:result.ticketId,payload:{summary:`The client accepted delivery for job ${id}. Testimonial and referral follow-up are now available.`,dashboardUrl:`${(process.env.APP_BASE_URL??"").replace(/\/$/,"")}/admin/jobs/${id}`}});return NextResponse.json({...result,status:"completed"})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"ACCEPTANCE_FAILED"},{status:409})}finally{await repo.close()}
}
