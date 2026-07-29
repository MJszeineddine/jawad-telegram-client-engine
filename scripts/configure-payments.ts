import { chmod, readFile, writeFile } from "node:fs/promises";
import { stdin, stdout } from "node:process";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

const envPath = new URL("../.env", import.meta.url);
const USDT_TRC20_CONTRACT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDC_BASE_CONTRACT_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_CHAIN_ID = "8453";

function parseEnv(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator > 0) values[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return values;
}

function mergeEnv(text: string, updates: Record<string, string>): string {
  const written = new Set<string>();
  const output: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const separator = raw.indexOf("=");
    const key = separator > 0 ? raw.slice(0, separator) : "";
    if (key && Object.hasOwn(updates, key)) {
      output.push(`${key}=${updates[key]}`);
      written.add(key);
    } else if (raw) output.push(raw);
  }
  for (const [key, value] of Object.entries(updates)) if (!written.has(key)) output.push(`${key}=${value}`);
  return `${output.join("\n").trim()}\n`;
}

async function hidden(question: string, current?: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error("PAYMENT_CONFIGURATION_REQUIRES_INTERACTIVE_TERMINAL");
  const rl = createInterface({ input: stdin, output: stdout });
  const previous = spawnSync("stty", ["-g"], { encoding: "utf8" }).stdout.trim();
  try {
    stdout.write(`${question}${current ? " [press Enter to keep current]" : ""}: `);
    spawnSync("stty", ["-echo"]);
    const answer = await rl.question("");
    stdout.write("\n");
    return answer.trim() || current || "";
  } finally {
    if (previous) spawnSync("stty", [previous]);
    rl.close();
  }
}

function requireTronAddress(value: string, label: string): void {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)) throw new Error(`${label}_INVALID_TRON_BASE58`);
}

function requireEvmAddress(value: string, label: string): void {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error(`${label}_INVALID_EVM_ADDRESS`);
}

function requireHttpsUrl(value: string, label: string): void {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error(`${label}_MUST_BE_HTTPS_WITHOUT_EMBEDDED_CREDENTIALS`);
}

async function verifyBaseRpc(rpcUrl: string): Promise<void> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json() as { result?: string };
  if (payload.result?.toLowerCase() !== "0x2105") throw new Error("BASE_RPC_CHAIN_ID_NOT_8453");
}

async function verifyTronApi(apiBaseUrl: string, apiKey: string): Promise<void> {
  const base = apiBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/walletsolidity/getnowblock`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(apiKey ? { "TRON-PRO-API-KEY": apiKey } : {}) },
    body: "{}",
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json() as { block_header?: { raw_data?: { number?: number } } };
  if (!Number.isSafeInteger(payload.block_header?.raw_data?.number)) throw new Error("TRON_API_CONNECTIVITY_FAILED");
}

const text = await readFile(envPath, "utf8").catch(() => "");
const existing = parseEnv(text);
const usdtAddress = await hidden("USDT TRC20 receiving address", existing.USDT_TRC20_RECEIVING_ADDRESS);
const usdcAddress = await hidden("USDC Base receiving address", existing.USDC_BASE_RECEIVING_ADDRESS);
const tronApiBase = await hidden("TRON API base URL", existing.TRON_API_BASE_URL || "https://api.trongrid.io");
const tronApiKey = await hidden("TRON API key (optional)", existing.TRON_API_KEY);
const baseRpcUrl = await hidden("Base RPC URL", existing.BASE_RPC_URL);

if (!usdtAddress && !usdcAddress) throw new Error("AT_LEAST_ONE_RECEIVING_ADDRESS_REQUIRED");
if (usdtAddress) requireTronAddress(usdtAddress, "USDT_TRC20_RECEIVING_ADDRESS");
if (usdcAddress) requireEvmAddress(usdcAddress, "USDC_BASE_RECEIVING_ADDRESS");
if (tronApiBase) requireHttpsUrl(tronApiBase, "TRON_API_BASE_URL");
if (baseRpcUrl) requireHttpsUrl(baseRpcUrl, "BASE_RPC_URL");
if (usdcAddress && !baseRpcUrl) throw new Error("BASE_RPC_URL_REQUIRED_FOR_USDC_BASE");

if (tronApiBase) await verifyTronApi(tronApiBase, tronApiKey);
if (baseRpcUrl) await verifyBaseRpc(baseRpcUrl);

await writeFile(envPath, mergeEnv(text, {
  ...(usdtAddress ? { USDT_TRC20_RECEIVING_ADDRESS: usdtAddress, USDT_TRC20_TOKEN_CONTRACT: USDT_TRC20_CONTRACT_ADDRESS } : {}),
  ...(usdcAddress ? { USDC_BASE_RECEIVING_ADDRESS: usdcAddress, USDC_BASE_TOKEN_CONTRACT: USDC_BASE_CONTRACT_ADDRESS, BASE_CHAIN_ID } : {}),
  ...(tronApiBase ? { TRON_API_BASE_URL: tronApiBase } : {}),
  ...(tronApiKey ? { TRON_API_KEY: tronApiKey } : {}),
  ...(baseRpcUrl ? { BASE_RPC_URL: baseRpcUrl } : {}),
}), { mode: 0o600 });
await chmod(envPath, 0o600);

console.log(JSON.stringify({
  ok: true,
  usdtTrc20Configured: Boolean(usdtAddress),
  usdcBaseConfigured: Boolean(usdcAddress),
  tronConnectivity: Boolean(tronApiBase),
  baseConnectivity: Boolean(baseRpcUrl),
  secretsPrinted: false,
  writesIgnoredEnvOnly: true,
}));
