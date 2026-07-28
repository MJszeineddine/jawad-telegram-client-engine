import { NextResponse } from "next/server";
import { createPostgresRepository } from "@jawad/database";
import { sameOrigin,verifyAdminSession,verifyCsrfToken } from "@jawad/security";
function cookie(request:Request,name:string){return request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1]}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  if(!sameOrigin(request.url,request.headers.get("origin")))return NextResponse.json({error:"ORIGIN_REJECTED"},{status:403});
  const secret=process.env.ADMIN_SESSION_SECRET??"";const sessionToken=cookie(request,"jawad_admin_session");const session=verifyAdminSession(sessionToken,secret);const form=await request.formData();const csrf=String(form.get("csrf")??"");
  if(!session||session.role!=="owner"||csrf!==cookie(request,"jawad_csrf")||!verifyCsrfToken(sessionToken??"",csrf,secret))return NextResponse.json({error:"AUTH_REJECTED"},{status:403});
  const accessChecklist=String(form.get("accessChecklist")??"").split("\n").map(value=>value.trim()).filter(Boolean).slice(0,50);const internalNotes=String(form.get("internalNotes")??"").trim().slice(0,12000);const rawDeadline=String(form.get("deadline")??"");const deadline=rawDeadline?new Date(rawDeadline):null;if(deadline&&Number.isNaN(deadline.getTime()))return NextResponse.json({error:"INVALID_DEADLINE"},{status:422});const {id}=await params;
  if((process.env.DEMO_MODE??"true")==="true")return NextResponse.redirect(new URL(`/admin/jobs/${id}`,request.url),303);if(!process.env.DATABASE_URL||!process.env.DATA_ENCRYPTION_KEY)return NextResponse.json({error:"DATABASE_NOT_CONFIGURED"},{status:503});
  const repo=await createPostgresRepository(process.env.DATABASE_URL,process.env.DATA_ENCRYPTION_KEY);try{const updated=await repo.updateJobDetails(id,session.subject,{accessChecklist,...(internalNotes?{internalNotes}:{}),deadline});if(!updated)return NextResponse.json({error:"JOB_NOT_FOUND"},{status:404});return NextResponse.redirect(new URL(`/admin/jobs/${id}`,request.url),303)}finally{await repo.close()}
}
