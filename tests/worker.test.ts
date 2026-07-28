import test from "node:test";
import assert from "node:assert/strict";
import { notificationText, processQueueJob, queueJobId, validateQueueJob, resolveWatcherAssignments } from "../apps/worker/src/core.ts";

test("worker jobs validate and redact secrets", () => {
  const output = processQueueJob({ id: "1", type: "NOTIFY", payload: { token: "secret", summary: "safe" }, attempts: 0 });
  assert.equal(output.safePayload.token, "[REDACTED]");
  assert.throws(() => validateQueueJob({ type: "UNKNOWN" }), /INVALID_QUEUE_JOB/);
});

test("scheduler IDs are deterministic and notification text is bounded", () => {
  assert.equal(queueJobId("PAYMENT_WATCH", "wallet", "2026-07-28T12:00"), queueJobId("PAYMENT_WATCH", "wallet", "2026-07-28T12:00"));
  const text = notificationText({ kind: "Payment confirmed", jobId: "job-1", dashboardUrl: "https://desk.example/admin", summary: "<b>safe</b>" });
  assert.match(text, /Payment confirmed/);
  assert.doesNotMatch(text, /[<>]/);
});

test("watcher resolver never auto-assigns a transfer shared by invoices",()=>{const invoice=(id:string,amount=100n)=>({id,network:"BASE_USDC" as const,token:"USDC" as const,recipient:"0xabc",tokenContract:"0xtoken",amountMinor:amount,decimals:6,createdAt:1,expiresAt:100,status:"OPEN" as const});const transfer={txHash:"0xshared",network:"BASE_USDC" as const,success:true,tokenContract:"0xtoken",from:"0xfrom",to:"0xabc",amountMinor:100n,confirmations:12,timestamp:10};const result=resolveWatcherAssignments([invoice("a"),invoice("b")],[transfer],12);assert.equal(result.confirmed.length,0);assert.equal(result.ambiguous.size,2)});
test("watcher resolver assigns only unique exact matches",()=>{const invoices=[{id:"a",network:"BASE_USDC" as const,token:"USDC" as const,recipient:"0xabc",tokenContract:"0xtoken",amountMinor:100n,decimals:6,createdAt:1,expiresAt:100,status:"OPEN" as const},{id:"b",network:"BASE_USDC" as const,token:"USDC" as const,recipient:"0xabc",tokenContract:"0xtoken",amountMinor:200n,decimals:6,createdAt:1,expiresAt:100,status:"OPEN" as const}];const transfers=[{txHash:"one",network:"BASE_USDC" as const,success:true,tokenContract:"0xtoken",from:"x",to:"0xabc",amountMinor:100n,confirmations:12,timestamp:10},{txHash:"two",network:"BASE_USDC" as const,success:true,tokenContract:"0xtoken",from:"x",to:"0xabc",amountMinor:200n,confirmations:12,timestamp:10}];const result=resolveWatcherAssignments(invoices,transfers,12);assert.equal(result.confirmed.length,2);assert.equal(result.ambiguous.size,0)});
