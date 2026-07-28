import { NextResponse } from "next/server";
export const dynamic="force-dynamic";
export function GET(){return NextResponse.json({ok:true,service:"jawad-telegram-client-engine",mode:(process.env.DEMO_MODE??"true")==="true"?"demo":"production",time:new Date().toISOString()},{headers:{"cache-control":"no-store"}})}
