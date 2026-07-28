import { NextResponse } from "next/server";
import { isDemoMode } from "@jawad/config";
import { createPostgresRepository } from "@jawad/database";
import { HttpBodyError,readJsonBody } from "../../../lib/http";
import { telegramClient } from "../../../lib/telegram-client";
import { allowRequest } from "../../../lib/rate-limit";

export async function POST(request:Request){
  const client=telegramClient(request);if(!client)return NextResponse.json({error:"INVALID_TELEGRAM_IDENTITY"},{status:401});
  const limit=await allowRequest("testimonial",client.id);if(!limit.allowed)return NextResponse.json({error:"RATE_LIMITED",retryAfterMs:limit.retryAfterMs},{status:429});
  let body:{jobId?:string;response?:string;permissionToPublish?:boolean};try{body=await readJsonBody(request,8_000)}catch(error){if(error instanceof HttpBodyError)return NextResponse.json({error:error.code},{status:error.status});return NextResponse.json({error:"INVALID_REQUEST"},{status:400})}
  const jobId=String(body.jobId??"").trim();const response=String(body.response??"").trim();if(!jobId||response.length<10||response.length>4000)return NextResponse.json({error:"INVALID_TESTIMONIAL"},{status:422});
  if(isDemoMode())return NextResponse.json({id:"demo-testimonial",status:"received",demo:true},{status:201});
  if(!process.env.DATABASE_URL||!process.env.DATA_ENCRYPTION_KEY)return NextResponse.json({error:"DATABASE_NOT_CONFIGURED"},{status:503});
  const repo=await createPostgresRepository(process.env.DATABASE_URL,process.env.DATA_ENCRYPTION_KEY);
  try{const id=await repo.submitTestimonial({jobId,telegramUserId:client.id,response,permissionToPublish:Boolean(body.permissionToPublish)});return NextResponse.json({id,status:"received"},{status:201})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"TESTIMONIAL_FAILED"},{status:409})}finally{await repo.close()}
}
