import { NextResponse } from "next/server";
import { validateTelegramInitData } from "@jawad/telegram";
import { HttpBodyError,readJsonBody } from "../../../../lib/http";
import { allowRequest,requestAddress } from "../../../../lib/rate-limit";

export async function POST(request:Request){
  const limit=await allowRequest("intake",requestAddress(request));
  if(!limit.allowed)return NextResponse.json({ok:false,error:"RATE_LIMITED",retryAfterMs:limit.retryAfterMs},{status:429});
  try{
    const {initData}=await readJsonBody<{initData?:string}>(request,64_000);
    const token=process.env.TELEGRAM_BOT_TOKEN;
    if(!token)return NextResponse.json({ok:false,error:"BOT_NOT_CONFIGURED"},{status:503});
    const result=validateTelegramInitData(initData??"",token);
    return NextResponse.json(result,{status:result.ok&&result.user?.id?200:401,headers:{"cache-control":"no-store"}});
  }catch(error){
    if(error instanceof HttpBodyError)return NextResponse.json({ok:false,error:error.code},{status:error.status});
    return NextResponse.json({ok:false,error:"INVALID_REQUEST"},{status:400});
  }
}
