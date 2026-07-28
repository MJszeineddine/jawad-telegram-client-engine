import { createHash } from "node:crypto";
import { redactStructuredLog } from "../../../packages/security/src/index.ts";

export type QueueJobType = "PAYMENT_WATCH" | "NOTIFY" | "RETENTION_DELETE" | "DEADLINE_REMINDER";
export interface QueueJob {
  id: string;
  type: QueueJobType;
  payload: Record<string, unknown>;
  attempts: number;
}

export function validateQueueJob(input: unknown): QueueJob {
  if (!input || typeof input !== "object") throw new Error("INVALID_QUEUE_JOB");
  const value = input as Partial<QueueJob>;
  if (!value.id || !value.type || !["PAYMENT_WATCH", "NOTIFY", "RETENTION_DELETE", "DEADLINE_REMINDER"].includes(value.type)) throw new Error("INVALID_QUEUE_JOB");
  if (!value.payload || typeof value.payload !== "object" || Array.isArray(value.payload)) throw new Error("INVALID_QUEUE_PAYLOAD");
  return { id: value.id, type: value.type, payload: value.payload, attempts: Number(value.attempts ?? 0) };
}

export function queueJobId(type: QueueJobType, scope: string, window: string): string {
  return createHash("sha256").update(`${type}:${scope}:${window}`).digest("hex").slice(0, 40);
}

export function processQueueJob(input: QueueJob) {
  const job = validateQueueJob(input);
  if (job.attempts > 5) throw new Error("MAX_ATTEMPTS_EXCEEDED");
  return {
    id: job.id,
    status: "DONE" as const,
    type: job.type,
    safePayload: redactStructuredLog(job.payload),
    processedAt: new Date().toISOString(),
  };
}

export function notificationText(input: { kind: string; leadId?: string; jobId?: string; dashboardUrl: string; summary: string }): string {
  const safeSummary = input.summary.replace(/[<>]/g, "").slice(0, 700);
  const reference = input.jobId ? `Job ${input.jobId}` : input.leadId ? `Lead ${input.leadId}` : "Dev Desk";
  return `${input.kind}\n${reference}\n${safeSummary}\n${input.dashboardUrl}`;
}

import { watcherCandidates,type Invoice,type NormalizedTransfer } from "../../../packages/payments/src/index.ts";
export interface WatchInvoice extends Invoice { id:string }
export function resolveWatcherAssignments(invoices:WatchInvoice[],transfers:NormalizedTransfer[],minConfirmations:number){
  const matches=new Map<string,NormalizedTransfer[]>();const txInvoices=new Map<string,string[]>();
  for(const invoice of invoices){const candidates=watcherCandidates(invoice,transfers,minConfirmations);matches.set(invoice.id,candidates);for(const transfer of candidates)txInvoices.set(transfer.txHash,[...(txInvoices.get(transfer.txHash)??[]),invoice.id])}
  const ambiguous=new Map<string,string[]>();const confirmed:Array<{invoiceId:string;transfer:NormalizedTransfer}>=[];
  for(const invoice of invoices){const candidates=matches.get(invoice.id)??[];const shared=candidates.some(transfer=>(txInvoices.get(transfer.txHash)?.length??0)>1);if(candidates.length>1||shared){ambiguous.set(invoice.id,candidates.map(transfer=>transfer.txHash));continue}if(candidates.length===1)confirmed.push({invoiceId:invoice.id,transfer:candidates[0]!})}
  return{confirmed,ambiguous};
}
