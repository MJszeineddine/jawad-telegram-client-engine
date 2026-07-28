import type { StoredAttachment } from "../../../packages/attachments/src/index.ts";
import type { WizardSession } from "./wizard.ts";

export interface BotWizardState {session?:WizardSession;startParam?:string;attachments:StoredAttachment[]}
export interface BotWizardStore {
  get(key:string):Promise<BotWizardState|undefined>;
  set(key:string,state:BotWizardState,ttlSeconds?:number):Promise<void>;
  delete(key:string):Promise<void>;
  close?():Promise<void>;
}
export class MemoryBotWizardStore implements BotWizardStore {
  private readonly entries=new Map<string,{state:BotWizardState;expiresAt:number}>();
  async get(key:string){const entry=this.entries.get(key);if(!entry)return undefined;if(entry.expiresAt<=Date.now()){this.entries.delete(key);return undefined}return structuredClone(entry.state)}
  async set(key:string,state:BotWizardState,ttlSeconds=7*24*60*60){this.entries.set(key,{state:structuredClone(state),expiresAt:Date.now()+ttlSeconds*1000})}
  async delete(key:string){this.entries.delete(key)}
}
export async function createRedisBotWizardStore(redisUrl:string,prefix="jawad:bot:wizard:"):Promise<BotWizardStore>{
  if(!/^rediss?:\/\//.test(redisUrl))throw new Error("INVALID_REDIS_URL");const module=await import("ioredis") as any;const Redis=module.default??module;const redis=new Redis(redisUrl,{maxRetriesPerRequest:2,enableReadyCheck:true,lazyConnect:false});
  return{async get(key){const raw=await redis.get(`${prefix}${key}`);if(!raw)return undefined;const parsed=JSON.parse(raw) as BotWizardState;return{...parsed,attachments:Array.isArray(parsed.attachments)?parsed.attachments:[]}},async set(key,state,ttlSeconds=7*24*60*60){await redis.set(`${prefix}${key}`,JSON.stringify(state),"EX",ttlSeconds)},async delete(key){await redis.del(`${prefix}${key}`)},async close(){await redis.quit()}};
}
