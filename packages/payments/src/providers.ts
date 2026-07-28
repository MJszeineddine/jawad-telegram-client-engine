import { createHash } from "node:crypto";
import {
  type Invoice,
  type NormalizedTransfer,
  type VerificationEvidence,
  type PaymentLedger,
  normalizeBaseUsdcTransfer,
} from "./index.ts";

const TRANSFER_TOPIC = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export interface FetchLike {
  (input: string | URL, init?: RequestInit): Promise<Response>;
}

export interface TransactionLookup {
  txHash: string;
  recipient: string;
  tokenContract: string;
}

export interface ReadOnlyPaymentProvider {
  readonly network: Invoice["network"];
  fetchTransfer(input: TransactionLookup): Promise<NormalizedTransfer>;
}

function requireHex(value: string, bytes: number, label: string): string {
  const normalized = value.toLowerCase().replace(/^0x/, "");
  if (!new RegExp(`^[0-9a-f]{${bytes * 2}}$`).test(normalized)) throw new Error(`INVALID_${label}`);
  return normalized;
}

function toInteger(hex: string, label: string): number {
  if (!/^0x[0-9a-f]+$/i.test(hex)) throw new Error(`INVALID_${label}`);
  const value = Number.parseInt(hex.slice(2), 16);
  if (!Number.isSafeInteger(value)) throw new Error(`INVALID_${label}`);
  return value;
}

async function readJson(response: Response, label: string): Promise<any> {
  if (!response.ok) throw new Error(`${label}_HTTP_${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${label}_INVALID_JSON`);
  }
}

async function jsonRpc(fetcher: FetchLike, endpoint: string, method: string, params: unknown[], timeoutMs: number): Promise<any> {
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await readJson(response, "BASE_RPC");
  if (payload?.error) throw new Error(`BASE_RPC_${String(payload.error.code ?? "ERROR")}`);
  if (payload?.result === undefined || payload?.result === null) throw new Error(`BASE_RPC_EMPTY_${method}`);
  return payload.result;
}

export class BaseRpcPaymentProvider implements ReadOnlyPaymentProvider {
  readonly network = "BASE_USDC" as const;
  private readonly config: { rpcUrl: string; chainId?: number; fetcher?: FetchLike; timeoutMs?: number };
  constructor(config: { rpcUrl: string; chainId?: number; fetcher?: FetchLike; timeoutMs?: number }) {
    if (!/^https:\/\//i.test(config.rpcUrl)) throw new Error("BASE_RPC_URL_MUST_USE_HTTPS");
    this.config = config;
  }

  async fetchTransfer(input: TransactionLookup): Promise<NormalizedTransfer> {
    const txHash = `0x${requireHex(input.txHash, 32, "BASE_TX_HASH")}`;
    const recipient = `0x${requireHex(input.recipient, 20, "BASE_RECIPIENT")}`;
    const tokenContract = `0x${requireHex(input.tokenContract, 20, "BASE_TOKEN_CONTRACT")}`;
    const fetcher = this.config.fetcher ?? fetch;
    const timeoutMs = this.config.timeoutMs ?? 12_000;
    const [chainHex, receipt, latestBlockHex] = await Promise.all([
      jsonRpc(fetcher, this.config.rpcUrl, "eth_chainId", [], timeoutMs),
      jsonRpc(fetcher, this.config.rpcUrl, "eth_getTransactionReceipt", [txHash], timeoutMs),
      jsonRpc(fetcher, this.config.rpcUrl, "eth_blockNumber", [], timeoutMs),
    ]);
    const chainId = toInteger(chainHex, "BASE_CHAIN_ID");
    const expectedChainId = this.config.chainId ?? 8453;
    if (chainId !== expectedChainId) throw new Error("WRONG_BASE_CHAIN");
    const receiptBlock = toInteger(String(receipt.blockNumber), "BASE_RECEIPT_BLOCK");
    const latestBlock = toInteger(latestBlockHex, "BASE_LATEST_BLOCK");
    if (latestBlock < receiptBlock) throw new Error("BASE_RPC_BLOCK_REGRESSION");
    const block = await jsonRpc(fetcher, this.config.rpcUrl, "eth_getBlockByNumber", [receipt.blockNumber, false], timeoutMs);
    const timestampSeconds = toInteger(String(block.timestamp), "BASE_BLOCK_TIMESTAMP");
    return normalizeBaseUsdcTransfer(receipt, {
      chainId,
      expectedChainId,
      confirmations: latestBlock - receiptBlock + 1,
      timestamp: timestampSeconds * 1_000,
      recipient,
      tokenContract,
    });
  }
}

function hexBytes(value: string): Uint8Array {
  const normalized = value.replace(/^0x/, "");
  if (!/^(?:[0-9a-f]{2})+$/i.test(normalized)) throw new Error("INVALID_HEX_BYTES");
  return Uint8Array.from(normalized.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)));
}

function base58Encode(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) value = value * 256n + BigInt(byte);
  let encoded = "";
  while (value > 0n) {
    const remainder = Number(value % 58n);
    encoded = BASE58_ALPHABET[remainder]! + encoded;
    value /= 58n;
  }
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros += 1;
  return "1".repeat(leadingZeros) + (encoded || "1");
}

export function tronHexAddressToBase58(value: string): string {
  let normalized = value.toLowerCase().replace(/^0x/, "");
  if (/^[0-9a-f]{40}$/.test(normalized)) normalized = `41${normalized}`;
  if (!/^41[0-9a-f]{40}$/.test(normalized)) throw new Error("INVALID_TRON_HEX_ADDRESS");
  const body = hexBytes(normalized);
  const first = createHash("sha256").update(body).digest();
  const checksum = createHash("sha256").update(first).digest().subarray(0, 4);
  return base58Encode(Uint8Array.from([...body, ...checksum]));
}

function tronTopicAddress(topic: string): string {
  const normalized = topic.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new Error("INVALID_TRON_ADDRESS_TOPIC");
  return tronHexAddressToBase58(normalized.slice(-40));
}

interface TronTransactionInfo {
  id?: string;
  blockNumber?: number;
  blockTimeStamp?: number;
  receipt?: { result?: string };
  log?: Array<{ address?: string; topics?: string[]; data?: string }>;
}

function tronHeaders(apiKey?: string): Record<string, string> {
  return { "content-type": "application/json", ...(apiKey ? { "TRON-PRO-API-KEY": apiKey } : {}) };
}

export class TronGridPaymentProvider implements ReadOnlyPaymentProvider {
  readonly network = "TRON_TRC20" as const;
  private readonly config: { apiBaseUrl?: string; apiKey?: string; fetcher?: FetchLike; timeoutMs?: number };
  constructor(config: { apiBaseUrl?: string; apiKey?: string; fetcher?: FetchLike; timeoutMs?: number }) {
    const endpoint = config.apiBaseUrl ?? "https://api.trongrid.io";
    if (!/^https:\/\//i.test(endpoint)) throw new Error("TRON_API_URL_MUST_USE_HTTPS");
    this.config = config;
  }

  async fetchTransfer(input: TransactionLookup): Promise<NormalizedTransfer> {
    const txHash = requireHex(input.txHash, 32, "TRON_TX_HASH");
    const fetcher = this.config.fetcher ?? fetch;
    const timeoutMs = this.config.timeoutMs ?? 12_000;
    const base = (this.config.apiBaseUrl ?? "https://api.trongrid.io").replace(/\/$/, "");
    const headers = tronHeaders(this.config.apiKey);
    const [infoResponse, latestResponse] = await Promise.all([
      fetcher(`${base}/walletsolidity/gettransactioninfobyid`, {
        method: "POST",
        headers,
        body: JSON.stringify({ value: txHash }),
        signal: AbortSignal.timeout(timeoutMs),
      }),
      fetcher(`${base}/walletsolidity/getnowblock`, {
        method: "POST",
        headers,
        body: "{}",
        signal: AbortSignal.timeout(timeoutMs),
      }),
    ]);
    const info = await readJson(infoResponse, "TRON_TX_INFO") as TronTransactionInfo;
    const latest = await readJson(latestResponse, "TRON_LATEST_BLOCK") as any;
    if (!info.id || info.id.toLowerCase() !== txHash) throw new Error("TRON_TRANSACTION_NOT_FOUND");
    const blockNumber = info.blockNumber;
    const blockTimeStamp = info.blockTimeStamp;
    if (!Number.isSafeInteger(blockNumber) || !Number.isSafeInteger(blockTimeStamp)) throw new Error("TRON_TRANSACTION_UNCONFIRMED");
    const confirmedBlockNumber = blockNumber as number;
    const confirmedBlockTimestamp = blockTimeStamp as number;
    const latestBlock = Number(latest?.block_header?.raw_data?.number);
    if (!Number.isSafeInteger(latestBlock) || latestBlock < confirmedBlockNumber) throw new Error("TRON_INVALID_LATEST_BLOCK");
    const expectedRecipient = input.recipient;
    const expectedToken = input.tokenContract;
    const transferLog = info.log?.find((log) => {
      const topic0 = log.topics?.[0]?.toLowerCase().replace(/^0x/, "");
      if (topic0 !== TRANSFER_TOPIC || !log.address || !log.topics?.[2]) return false;
      try {
        return tronHexAddressToBase58(log.address) === expectedToken && tronTopicAddress(log.topics[2]) === expectedRecipient;
      } catch {
        return false;
      }
    });
    if (!transferLog?.address || !transferLog.topics?.[1] || !transferLog.topics[2] || !transferLog.data) throw new Error("TRC20_TRANSFER_LOG_NOT_FOUND");
    const data = transferLog.data.replace(/^0x/, "");
    if (!/^[0-9a-f]{64}$/i.test(data)) throw new Error("INVALID_TRC20_AMOUNT");
    return {
      txHash: info.id,
      network: "TRON_TRC20",
      success: info.receipt?.result === "SUCCESS",
      tokenContract: tronHexAddressToBase58(transferLog.address),
      from: tronTopicAddress(transferLog.topics[1]),
      to: tronTopicAddress(transferLog.topics[2]),
      amountMinor: BigInt(`0x${data}`),
      confirmations: latestBlock - confirmedBlockNumber + 1,
      timestamp: confirmedBlockTimestamp,
    };
  }
}

export async function verifyTransactionHash(input: {
  invoice: Invoice;
  txHash: string;
  provider: ReadOnlyPaymentProvider;
  ledger: PaymentLedger;
  minConfirmations: number;
  now?: number;
}): Promise<VerificationEvidence> {
  if (input.provider.network !== input.invoice.network) return { ok: false, code: "WRONG_PROVIDER_NETWORK", details: [] };
  try {
    const transfer = await input.provider.fetchTransfer({
      txHash: input.txHash,
      recipient: input.invoice.recipient,
      tokenContract: input.invoice.tokenContract,
    });
    return input.ledger.verifyAndAssign(input.invoice.id, transfer, input.minConfirmations, input.now);
  } catch (error) {
    return { ok: false, code: "PROVIDER_LOOKUP_FAILED", details: [error instanceof Error ? error.message : "UNKNOWN_PROVIDER_ERROR"] };
  }
}

export interface AddressWatchInput { recipient:string;tokenContract:string;since:number;until:number;lookbackBlocks?:number;maxTransfers?:number }
export interface ReadOnlyAddressWatcher { readonly network:Invoice["network"];listTransfers(input:AddressWatchInput):Promise<NormalizedTransfer[]> }

export class BaseRpcAddressWatcher implements ReadOnlyAddressWatcher {
  readonly network="BASE_USDC" as const;
  private readonly config:{rpcUrl:string;chainId?:number;fetcher?:FetchLike;timeoutMs?:number};
  constructor(config:{rpcUrl:string;chainId?:number;fetcher?:FetchLike;timeoutMs?:number}){if(!/^https:\/\//i.test(config.rpcUrl))throw new Error("BASE_RPC_URL_MUST_USE_HTTPS");this.config=config}
  async listTransfers(input:AddressWatchInput):Promise<NormalizedTransfer[]>{
    const recipient=`0x${requireHex(input.recipient,20,"BASE_RECIPIENT")}`;const tokenContract=`0x${requireHex(input.tokenContract,20,"BASE_TOKEN_CONTRACT")}`;const fetcher=this.config.fetcher??fetch;const timeout=this.config.timeoutMs??12_000;const latestHex=await jsonRpc(fetcher,this.config.rpcUrl,"eth_blockNumber",[],timeout);const latest=toInteger(latestHex,"BASE_LATEST_BLOCK");const from=Math.max(0,latest-(input.lookbackBlocks??5_000)+1);const recipientTopic=`0x${recipient.slice(2).padStart(64,"0")}`;const logs=await jsonRpc(fetcher,this.config.rpcUrl,"eth_getLogs",[{address:tokenContract,fromBlock:`0x${from.toString(16)}`,toBlock:"latest",topics:[`0x${TRANSFER_TOPIC}`,null,recipientTopic]}],timeout) as Array<{transactionHash?:string}>;const hashes=[...new Set(logs.map(log=>log.transactionHash).filter((value):value is string=>Boolean(value)))].slice(0,input.maxTransfers??50);const provider=new BaseRpcPaymentProvider(this.config);const transfers:NormalizedTransfer[]=[];for(const txHash of hashes){try{const transfer=await provider.fetchTransfer({txHash,recipient,tokenContract});if(transfer.timestamp>=input.since&&transfer.timestamp<=input.until)transfers.push(transfer)}catch{/* malformed or reorged candidate is ignored and never assigned */}}return transfers;
  }
}

export class TronGridAddressWatcher implements ReadOnlyAddressWatcher {
  readonly network="TRON_TRC20" as const;
  private readonly config:{apiBaseUrl?:string;apiKey?:string;fetcher?:FetchLike;timeoutMs?:number};
  constructor(config:{apiBaseUrl?:string;apiKey?:string;fetcher?:FetchLike;timeoutMs?:number}){const endpoint=config.apiBaseUrl??"https://api.trongrid.io";if(!/^https:\/\//i.test(endpoint))throw new Error("TRON_API_URL_MUST_USE_HTTPS");this.config=config}
  async listTransfers(input:AddressWatchInput):Promise<NormalizedTransfer[]>{
    if(!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(input.recipient)||!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(input.tokenContract))throw new Error("INVALID_TRON_WATCH_ADDRESS");const fetcher=this.config.fetcher??fetch;const base=(this.config.apiBaseUrl??"https://api.trongrid.io").replace(/\/$/,"");const url=new URL(`${base}/v1/accounts/${encodeURIComponent(input.recipient)}/transactions/trc20`);url.searchParams.set("only_confirmed","true");url.searchParams.set("only_to","true");url.searchParams.set("limit",String(Math.min(200,input.maxTransfers??50)));url.searchParams.set("contract_address",input.tokenContract);url.searchParams.set("min_timestamp",String(input.since));const response=await fetcher(url,{headers:tronHeaders(this.config.apiKey),signal:AbortSignal.timeout(this.config.timeoutMs??12_000)});const payload=await readJson(response,"TRON_ACCOUNT_HISTORY") as {data?:Array<{transaction_id?:string}>};const hashes=[...new Set((payload.data??[]).map(item=>item.transaction_id).filter((value):value is string=>Boolean(value)))].slice(0,input.maxTransfers??50);const provider=new TronGridPaymentProvider(this.config);const transfers:NormalizedTransfer[]=[];for(const txHash of hashes){try{const transfer=await provider.fetchTransfer({txHash,recipient:input.recipient,tokenContract:input.tokenContract});if(transfer.timestamp>=input.since&&transfer.timestamp<=input.until)transfers.push(transfer)}catch{/* malformed candidate is ignored and never assigned */}}return transfers;
  }
}

export function watcherCandidates(invoice:Invoice,transfers:NormalizedTransfer[],minConfirmations:number){return transfers.filter(transfer=>transfer.network===invoice.network&&transfer.success&&transfer.tokenContract.toLowerCase()===invoice.tokenContract.toLowerCase()&&transfer.to.toLowerCase()===invoice.recipient.toLowerCase()&&transfer.amountMinor===invoice.amountMinor&&transfer.confirmations>=minConfirmations&&transfer.timestamp>=invoice.createdAt&&transfer.timestamp<=invoice.expiresAt)}
