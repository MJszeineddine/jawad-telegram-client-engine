import { NextResponse } from "next/server";
import { isDemoMode } from "@jawad/config";
import { createPostgresRepository } from "@jawad/database";
import { HttpBodyError,readJsonBody } from "../../../../lib/http";
import { telegramClient } from "../../../../lib/telegram-client";
import { allowRequest } from "../../../../lib/rate-limit";

export async function POST(request:Request){
  const client=telegramClient(request);if(!client)return NextResponse.json({error:"INVALID_TELEGRAM_IDENTITY"},{status:401});
  const limit=await allowRequest("privacy-delete",client.id);if(!limit.allowed)return NextResponse.json({error:"RATE_LIMITED",retryAfterMs:limit.retryAfterMs},{status:429});
  let body:{email?:string;notes?:string};try{body=await readJsonBody(request,8_000)}catch(error){if(error instanceof HttpBodyError)return NextResponse.json({error:error.code},{status:error.status});return NextResponse.json({error:"INVALID_REQUEST"},{status:400})}
  const email=String(body.email??"").trim();const notes=String(body.notes??"").trim();
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:"INVALID_EMAIL"},{status:422});
  if(notes.length>1000)return NextResponse.json({error:"NOTES_TOO_LONG"},{status:422});
  if(isDemoMode())return NextResponse.json({id:"demo-deletion-request",status:"open",demo:true});
  if(!process.env.DATABASE_URL||!process.env.DATA_ENCRYPTION_KEY)return NextResponse.json({error:"DATABASE_NOT_CONFIGURED"},{status:503});
  const repo=await createPostgresRepository(process.env.DATABASE_URL,process.env.DATA_ENCRYPTION_KEY);
  try{const id=await repo.createDeletionRequest({telegramUserId:client.id,...(email?{email}:{}),...(notes?{notes}:{})});return NextResponse.json({id,status:"open"},{status:201})}finally{await repo.close()}
}
