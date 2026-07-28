import { NextResponse } from "next/server";
import { validateTelegramInitData } from "@jawad/telegram";
export async function POST(request:Request){
  const length=Number(request.headers.get("content-length")??0);if(length>64_000)return NextResponse.json({ok:false,error:"BODY_TOO_LARGE"},{status:413});
  const {initData}=await request.json() as {initData?:string};const token=process.env.TELEGRAM_BOT_TOKEN;if(!token)return NextResponse.json({ok:false,error:"BOT_NOT_CONFIGURED"},{status:503});
  const result=validateTelegramInitData(initData??"",token);return NextResponse.json(result,{status:result.ok?200:401,headers:{"cache-control":"no-store"}});
}
