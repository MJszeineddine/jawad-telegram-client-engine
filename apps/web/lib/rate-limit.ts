import { SlidingWindowRateLimiter } from "@jawad/telegram";
type RateScope="intake"|"attachment"|"payment"|"admin-login"|"privacy-delete"|"testimonial"|"client-message"|"job-accept";
const globalState=globalThis as typeof globalThis&{__jawadRateLimiters?:Record<RateScope,SlidingWindowRateLimiter>};
const limiters=globalState.__jawadRateLimiters??={intake:new SlidingWindowRateLimiter(8,60_000),attachment:new SlidingWindowRateLimiter(12,60_000),payment:new SlidingWindowRateLimiter(8,60_000),"admin-login":new SlidingWindowRateLimiter(8,15*60_000),"privacy-delete":new SlidingWindowRateLimiter(3,60*60_000),testimonial:new SlidingWindowRateLimiter(5,60*60_000),"client-message":new SlidingWindowRateLimiter(20,60*60_000),"job-accept":new SlidingWindowRateLimiter(5,60*60_000)};globalState.__jawadRateLimiters=limiters;
export function allowRequest(scope:RateScope,key:string){return limiters[scope].allow(`${scope}:${key}`)}
export function requestAddress(request:Request){return(request.headers.get("x-real-ip")??request.headers.get("x-forwarded-for")?.split(",")[0]??"unknown").trim().slice(0,100)}
