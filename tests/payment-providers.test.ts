import test from "node:test";
import assert from "node:assert/strict";
import {
  BaseRpcPaymentProvider,
  PaymentLedger,
  TronGridPaymentProvider,
  tronHexAddressToBase58,
  verifyTransactionHash,
  watcherCandidates,
  type FetchLike,
} from "../packages/payments/src/index.ts";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}
function addressTopic(hex40: string): string { return hex40.padStart(64, "0"); }

const tronRecipientHex = "1111111111111111111111111111111111111111";
const tronSenderHex = "2222222222222222222222222222222222222222";
const tronTokenHex = "3333333333333333333333333333333333333333";
const transferTopic = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

test("TRON Base58Check conversion is deterministic", () => {
  assert.equal(tronHexAddressToBase58(`41${"00".repeat(20)}`), "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb");
});

test("TronGrid provider reads a confirmed successful TRC20 transfer", async () => {
  const txHash = "ab".repeat(32);
  const fetcher: FetchLike = async (url) => String(url).endsWith("getnowblock")
    ? json({ block_header: { raw_data: { number: 120 } } })
    : json({
      id: txHash,
      blockNumber: 100,
      blockTimeStamp: 1_700_000_000_000,
      receipt: { result: "SUCCESS" },
      log: [{
        address: tronTokenHex,
        topics: [transferTopic, addressTopic(tronSenderHex), addressTopic(tronRecipientHex)],
        data: (100_000_000n).toString(16).padStart(64, "0"),
      }],
    });
  const provider = new TronGridPaymentProvider({ fetcher });
  const transfer = await provider.fetchTransfer({
    txHash,
    recipient: tronHexAddressToBase58(tronRecipientHex),
    tokenContract: tronHexAddressToBase58(tronTokenHex),
  });
  assert.equal(transfer.amountMinor, 100_000_000n);
  assert.equal(transfer.confirmations, 21);
  assert.equal(transfer.success, true);
});

test("Base RPC provider validates chain, receipt, transfer log, confirmations, and timestamp", async () => {
  const txHash = `0x${"ab".repeat(32)}`;
  const recipient = `0x${"11".repeat(20)}`;
  const sender = `0x${"22".repeat(20)}`;
  const token = `0x${"33".repeat(20)}`;
  const responses: Record<string, unknown> = {
    eth_chainId: "0x2105",
    eth_blockNumber: "0x78",
    eth_getTransactionReceipt: {
      transactionHash: txHash,
      status: "0x1",
      blockNumber: "0x64",
      logs: [{
        address: token,
        topics: [`0x${transferTopic}`, `0x${addressTopic(sender.slice(2))}`, `0x${addressTopic(recipient.slice(2))}`],
        data: "0x5f5e100",
      }],
    },
    eth_getBlockByNumber: { timestamp: "0x6553f100" },
  };
  const fetcher: FetchLike = async (_url, init) => {
    const method = JSON.parse(String(init?.body)).method as string;
    return json({ jsonrpc: "2.0", id: 1, result: responses[method] });
  };
  const provider = new BaseRpcPaymentProvider({ rpcUrl: "https://base.example", fetcher });
  const transfer = await provider.fetchTransfer({ txHash, recipient, tokenContract: token });
  assert.equal(transfer.amountMinor, 100_000_000n);
  assert.equal(transfer.confirmations, 21);
  assert.equal(transfer.timestamp, 1_700_000_000_000);
});

test("provider verification assigns the transaction once and remains idempotent", async () => {
  const ledger = new PaymentLedger();
  const now = 1_700_000_000_000;
  const recipient = `0x${"11".repeat(20)}`;
  const token = `0x${"33".repeat(20)}`;
  const invoice = ledger.create({ network: "BASE_USDC", token: "USDC", recipient, tokenContract: token, amountMinor: 100_000_000n, decimals: 6, createdAt: now - 1_000, expiresAt: now + 60_000 });
  const provider = {
    network: "BASE_USDC" as const,
    async fetchTransfer() {
      return { txHash: `0x${"aa".repeat(32)}`, network: "BASE_USDC" as const, success: true, tokenContract: token, from: `0x${"22".repeat(20)}`, to: recipient, amountMinor: 100_000_000n, confirmations: 12, timestamp: now };
    },
  };
  assert.equal((await verifyTransactionHash({ invoice, txHash: `0x${"aa".repeat(32)}`, provider, ledger, minConfirmations: 12, now })).code, "PAYMENT_CONFIRMED");
  assert.equal((await verifyTransactionHash({ invoice, txHash: `0x${"aa".repeat(32)}`, provider, ledger, minConfirmations: 12, now })).code, "ALREADY_PAID_IDEMPOTENT");
});

test("providers reject insecure endpoints and missing transfer logs", async () => {
  assert.throws(() => new BaseRpcPaymentProvider({ rpcUrl: "http://localhost:8545" }), /HTTPS/);
  assert.throws(() => new TronGridPaymentProvider({ apiBaseUrl: "http://localhost" }), /HTTPS/);
});

test("watcher candidates require exact amount, window, destination, token, and confirmations",()=>{const invoice={id:"i",network:"BASE_USDC" as const,token:"USDC" as const,recipient:`0x${"11".repeat(20)}`,tokenContract:`0x${"33".repeat(20)}`,amountMinor:100n,decimals:6,createdAt:1000,expiresAt:2000,status:"OPEN" as const};const base={txHash:`0x${"aa".repeat(32)}`,network:"BASE_USDC" as const,success:true,tokenContract:invoice.tokenContract,from:`0x${"22".repeat(20)}`,to:invoice.recipient,amountMinor:100n,confirmations:12,timestamp:1500};assert.equal(watcherCandidates(invoice,[base,{...base,txHash:"b",amountMinor:101n},{...base,txHash:"c",confirmations:1}],12).length,1)});
