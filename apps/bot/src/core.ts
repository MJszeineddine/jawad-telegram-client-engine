import { parseAttribution } from "../../../packages/domain/src/index.ts";
export const commands = ["start","fix","agency","rescue","portfolio","services","pricing","availability","payment","status","privacy","cancel","help"] as const;
export interface BotReply { text:string; buttons?:{text:string;action:string}[][]; }
export function processMockUpdate(update:{text?:string;startParam?:string}):BotReply {
  const text=(update.text??"").trim();
  if(text.startsWith("/start")){ const param=update.startParam??text.split(/\s+/)[1]; const a=parseAttribution(param); return {text:`Welcome to Jawad Dev Desk. Source: ${a.source}. Choose a safe intake path.`,buttons:[[{text:"Fix a Bug",action:"fix"},{text:"Agency Overflow",action:"agency"}],[{text:"Production Rescue",action:"rescue"},{text:"View Portfolio",action:"portfolio"}],[{text:"Check Availability",action:"availability"},{text:"How It Works",action:"how"}]]}; }
  if(text==="/privacy") return {text:"Never send passwords, tokens, .env files, private keys, seed phrases, or production database dumps. Attachments are restricted and retained only as configured."};
  if(text==="/pricing") return {text:"Quick Fix starts at 100 USDT/USDC. Rescue starts at 300 USDT/USDC. Production Sprints are manually quoted. Every quote requires Jawad's approval."};
  if(text==="/payment") return {text:"Supported: USDT on TRON/TRC20 and native USDC on Base. Wallet addresses are shown only from secure environment configuration. Wrong-network payments require manual review."};
  if(text==="/help") return {text:"Use /fix, /agency, or /rescue. Use /cancel to stop a submission. No request is automatically accepted."};
  return {text:"Use /start to open Jawad Dev Desk."};
}
