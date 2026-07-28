import { createHash, randomUUID } from "node:crypto";
export type Network = "TRON_TRC20" | "BASE_USDC";
export interface Invoice { id:string; network:Network; token:"USDT"|"USDC"; recipient:string; tokenContract:string; amountMinor:bigint; decimals:number; createdAt:number; expiresAt:number; status:"OPEN"|"PAID"|"EXPIRED"|"AMBIGUOUS"; txHash?:string; }
export interface NormalizedTransfer { txHash:string; network:Network; success:boolean; tokenContract:string; from:string; to:string; amountMinor:bigint; confirmations:number; timestamp:number; }
export interface VerificationEvidence { ok:boolean; code:string; details:string[]; transfer?:NormalizedTransfer; }
export class PaymentLedger {
  private assignments = new Map<string,string>();
  private invoices = new Map<string,Invoice>();
  create(input: Omit<Invoice,"id"|"status">): Invoice { const i={...input,id:randomUUID(),status:"OPEN" as const}; this.invoices.set(i.id,i); return i; }
  get(id:string){ return this.invoices.get(id); }
  verifyAndAssign(invoiceId:string, transfer:NormalizedTransfer, minConfirmations:number, now=Date.now()): VerificationEvidence {
    const invoice=this.invoices.get(invoiceId); if(!invoice) return {ok:false,code:"INVOICE_NOT_FOUND",details:[]};
    if(invoice.status==="PAID") return invoice.txHash===transfer.txHash ? {ok:true,code:"ALREADY_PAID_IDEMPOTENT",details:[]} : {ok:false,code:"INVOICE_ALREADY_PAID",details:[]};
    if(now>invoice.expiresAt) { invoice.status="EXPIRED"; return {ok:false,code:"INVOICE_EXPIRED",details:["Late payments require manual review"]}; }
    const assigned=this.assignments.get(transfer.txHash); if(assigned && assigned!==invoiceId) return {ok:false,code:"DUPLICATE_TX_HASH",details:[`Already assigned to ${assigned}`]};
    const errors:string[]=[];
    if(transfer.network!==invoice.network) errors.push("WRONG_NETWORK");
    if(!transfer.success) errors.push("FAILED_TRANSACTION");
    if(transfer.tokenContract.toLowerCase()!==invoice.tokenContract.toLowerCase()) errors.push("WRONG_TOKEN");
    if(transfer.to.toLowerCase()!==invoice.recipient.toLowerCase()) errors.push("WRONG_RECIPIENT");
    if(transfer.amountMinor<invoice.amountMinor) errors.push("INSUFFICIENT_AMOUNT");
    if(transfer.confirmations<minConfirmations) errors.push("INSUFFICIENT_CONFIRMATIONS");
    if(errors.length) return {ok:false,code:errors[0]!,details:errors,transfer};
    this.assignments.set(transfer.txHash,invoiceId); invoice.status="PAID"; invoice.txHash=transfer.txHash;
    return {ok:true,code:"PAYMENT_CONFIRMED",details:["Immutable assignment recorded"],transfer};
  }
  matchWatcher(invoiceId:string, transfers:NormalizedTransfer[], minConfirmations:number): VerificationEvidence {
    const invoice=this.invoices.get(invoiceId); if(!invoice) return {ok:false,code:"INVOICE_NOT_FOUND",details:[]};
    const candidates=transfers.filter(t=>t.network===invoice.network && t.success && t.tokenContract.toLowerCase()===invoice.tokenContract.toLowerCase() && t.to.toLowerCase()===invoice.recipient.toLowerCase() && t.amountMinor>=invoice.amountMinor && t.confirmations>=minConfirmations && t.timestamp>=invoice.createdAt && t.timestamp<=invoice.expiresAt && !this.assignments.has(t.txHash));
    if(candidates.length===0) return {ok:false,code:"NO_MATCH",details:[]};
    if(candidates.length>1) { invoice.status="AMBIGUOUS"; return {ok:false,code:"AMBIGUOUS_MATCH",details:candidates.map(c=>c.txHash)}; }
    return this.verifyAndAssign(invoiceId,candidates[0]!,minConfirmations);
  }
  assignmentDigest(){ return createHash("sha256").update(JSON.stringify([...this.assignments])).digest("hex"); }
}
export function formatToken(minor: bigint, decimals: number): string { const s=minor.toString().padStart(decimals+1,"0"); return `${s.slice(0,-decimals)}.${s.slice(-decimals)}`.replace(/\.0+$/,""); }
export function paymentUri(invoice:Invoice){ return [`JAWAD_DEV_DESK_INVOICE`,`network=${invoice.network}`,`token=${invoice.token}`,`recipient=${invoice.recipient}`,`amount=${formatToken(invoice.amountMinor,invoice.decimals)}`,`invoice=${invoice.id}`,`warning=Verify every field in the Mini App before paying`].join("\n"); }


export interface TronGridTransferRaw { transaction_id:string; block_timestamp:number; from:string; to:string; type?:string; value:string; token_info?:{address?:string;decimals?:number}; }
export function normalizeTronTransfer(raw:TronGridTransferRaw,confirmations:number):NormalizedTransfer{
  if(!raw.transaction_id||!raw.from||!raw.to||!raw.token_info?.address)throw new Error("INVALID_TRON_TRANSFER");
  return{txHash:raw.transaction_id,network:"TRON_TRC20",success:raw.type!=="Transfer"?false:true,tokenContract:raw.token_info.address,from:raw.from,to:raw.to,amountMinor:BigInt(raw.value),confirmations,timestamp:raw.block_timestamp};
}
const TRANSFER_TOPIC="0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export interface BaseReceiptRaw { transactionHash:string;status:string;blockNumber:string;logs:{address:string;topics:string[];data:string}[]; }
function topicAddress(topic:string){return "0x"+topic.slice(-40)}
export function normalizeBaseUsdcTransfer(receipt:BaseReceiptRaw,input:{chainId:number;expectedChainId:number;confirmations:number;timestamp:number;recipient:string;tokenContract:string}):NormalizedTransfer{
  if(input.chainId!==input.expectedChainId)throw new Error("WRONG_BASE_CHAIN"); const log=receipt.logs.find(l=>l.address.toLowerCase()===input.tokenContract.toLowerCase()&&l.topics[0]?.toLowerCase()===TRANSFER_TOPIC&&topicAddress(l.topics[2]??"").toLowerCase()===input.recipient.toLowerCase()); if(!log)throw new Error("USDC_TRANSFER_LOG_NOT_FOUND");
  return{txHash:receipt.transactionHash,network:"BASE_USDC",success:receipt.status==="0x1",tokenContract:log.address,from:topicAddress(log.topics[1]??""),to:topicAddress(log.topics[2]??""),amountMinor:BigInt(log.data),confirmations:input.confirmations,timestamp:input.timestamp};
}

export interface PrintableReceipt {
  receiptId: string;
  invoiceId: string;
  network: Network;
  token: "USDT" | "USDC";
  amount: string;
  recipient: string;
  status: Invoice["status"];
  txHash?: string;
  paidAt?: string;
  evidenceDigest?: string;
  referenceUsdMinor?: string;
}
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!)); }
export function buildReceipt(invoice: Invoice, input: { receiptId?: string; paidAt?: string; evidence?: VerificationEvidence; evidenceSource?: unknown; referenceUsdMinor?: bigint } = {}): PrintableReceipt {
  return {
    receiptId: input.receiptId ?? randomUUID(),
    invoiceId: invoice.id,
    network: invoice.network,
    token: invoice.token,
    amount: formatToken(invoice.amountMinor, invoice.decimals),
    recipient: invoice.recipient,
    status: invoice.status,
    ...(invoice.txHash ? { txHash: invoice.txHash } : {}),
    ...(input.paidAt ? { paidAt: input.paidAt } : {}),
    ...((input.evidence||input.evidenceSource!==undefined) ? { evidenceDigest: createHash("sha256").update(JSON.stringify(input.evidence??input.evidenceSource, (_key, value) => typeof value === "bigint" ? value.toString() : value)).digest("hex") } : {}),
    ...(input.referenceUsdMinor !== undefined ? { referenceUsdMinor: input.referenceUsdMinor.toString() } : {}),
  };
}
export function renderReceiptHtml(receipt: PrintableReceipt): string {
  const rows = Object.entries(receipt).filter(([, value]) => value !== undefined).map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(String(value))}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Jawad Dev Desk Receipt</title><style>body{font:16px system-ui;max-width:760px;margin:40px auto;padding:20px;color:#111}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #ddd;padding:10px;overflow-wrap:anywhere}.warning{padding:12px;background:#fff4cc;border:1px solid #d6b541}@media print{button{display:none}}</style></head><body><h1>Jawad Dev Desk receipt</h1><p class="warning">This receipt records a read-only verification result. It does not authorise refunds, payouts, or any outgoing transfer.</p><table>${rows}</table><button onclick="window.print()">Print or save as PDF</button></body></html>`;
}
export async function createPaymentQrDataUrl(invoice: Invoice): Promise<string> {
  const module = await import("qrcode") as any;
  const QRCode = module.default ?? module;
  return QRCode.toDataURL(paymentUri(invoice), { errorCorrectionLevel: "M", margin: 2, width: 320 });
}

export * from "./providers.ts";
