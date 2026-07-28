import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminSession, createCsrfToken, sameOrigin } from "@jawad/security";
import { CSRF_COOKIE, SESSION_COOKIE } from "../../../../lib/admin";
import { allowRequest,requestAddress } from "../../../../lib/rate-limit";
function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
export async function POST(request:Request){
  if(!sameOrigin(request.url,request.headers.get("origin")))return NextResponse.json({error:"ORIGIN_REJECTED"},{status:403});const limit=allowRequest("admin-login",requestAddress(request));if(!limit.allowed)return NextResponse.json({error:"RATE_LIMITED",retryAfterMs:limit.retryAfterMs},{status:429});
  const form=await request.formData();const password=String(form.get("password")??"");const demo=(process.env.DEMO_MODE??"true")==="true";const expected=process.env.ADMIN_PASSWORD_SHA256;
  const ok=demo?password==="demo-admin":Boolean(expected&&equal(createHash("sha256").update(password).digest("hex"),expected));if(!ok)return NextResponse.json({error:"INVALID_CREDENTIALS"},{status:401});
  const secret=process.env.ADMIN_SESSION_SECRET;if(!secret||secret.length<32)return NextResponse.json({error:"SESSION_NOT_CONFIGURED"},{status:503});
  const token=createAdminSession({subject:"jawad",role:"owner"},secret);const csrf=createCsrfToken(token,secret);const response=NextResponse.redirect(new URL("/admin",request.url),303);const secure=process.env.NODE_ENV==="production";response.cookies.set(SESSION_COOKIE,token,{httpOnly:true,sameSite:"strict",secure,path:"/",maxAge:8*60*60});response.cookies.set(CSRF_COOKIE,csrf,{httpOnly:false,sameSite:"strict",secure,path:"/",maxAge:8*60*60});return response;
}
