import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import {
  TELEGRAM_ALLOWED_UPDATES,
  parseRuntimePort,
  parseTelegramUpdateMode,
  startBotTransport,
  type TelegramRuntimeBot,
} from "../apps/bot/src/transport.ts";

function deferred<T=void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

class FakeBot implements TelegramRuntimeBot {
  readonly deletedWebhook: Array<{drop_pending_updates:boolean}>=[];
  readonly startCalls: Array<{allowed_updates:string[]}>=[];
  readonly updates: unknown[]=[];
  readonly polling=deferred<void>();
  onStart?: () => void;
  api={deleteWebhook:async(options:{drop_pending_updates:boolean})=>{this.deletedWebhook.push(options)}};
  start(options:{allowed_updates:string[];onStart?:(botInfo:unknown)=>void}):Promise<void>{
    this.startCalls.push({allowed_updates:options.allowed_updates});
    this.onStart=()=>options.onStart?.({username:"test"});
    return this.polling.promise;
  }
  stop():void{this.polling.resolve()}
  async handleUpdate(update:unknown):Promise<void>{this.updates.push(update)}
}

async function waitForHttp(url:string):Promise<Response>{
  let last:unknown;
  for(let attempt=0;attempt<40;attempt++){
    try{return await fetch(url,{signal:AbortSignal.timeout(500)})}catch(error){last=error;await new Promise(resolve=>setTimeout(resolve,25))}
  }
  throw last;
}

test("Telegram update mode is explicit and fails closed",()=>{
  assert.equal(parseTelegramUpdateMode("long_polling"),"long_polling");
  assert.equal(parseTelegramUpdateMode("webhook"),"webhook");
  assert.throws(()=>parseTelegramUpdateMode(undefined),/TELEGRAM_UPDATE_MODE/);
  assert.throws(()=>parseTelegramUpdateMode("auto"),/TELEGRAM_UPDATE_MODE/);
  assert.equal(parseRuntimePort("3101","BOT_HEALTH_PORT"),3101);
  assert.throws(()=>parseRuntimePort("0","BOT_HEALTH_PORT"),/between 1 and 65535/);
});

test("long polling owns a truthful health server and preserves queued updates",async()=>{
  const port=await freePort();
  const bot=new FakeBot();
  const logs:Record<string,unknown>[]=[];
  const starting=startBotTransport(bot,{mode:"long_polling",port,startupTimeoutMs:2_000,log:entry=>logs.push(entry)});

  const before=await waitForHttp(`http://127.0.0.1:${port}/health`);
  assert.equal(before.status,503);
  assert.deepEqual(await before.json(),{ok:false,ready:false,service:"telegram-bot",mode:"long_polling"});

  bot.onStart?.();
  const handle=await starting;
  const ready=await fetch(`http://127.0.0.1:${handle.port}/health`);
  assert.equal(ready.status,200);
  const payload=await ready.json() as {ready:boolean;mode:string};
  assert.equal(payload.ready,true);
  assert.equal(payload.mode,"long_polling");
  assert.deepEqual(bot.deletedWebhook,[{drop_pending_updates:false}]);
  assert.deepEqual(bot.startCalls,[{allowed_updates:[...TELEGRAM_ALLOWED_UPDATES]}]);
  assert.equal(logs.some(entry=>entry.mode==="long_polling"&&entry.ready===true),true);

  await handle.stop("test");
  await handle.completion;
});

test("webhook mode never starts polling and requires the secret header",async()=>{
  const bot=new FakeBot();
  const secret="a-safe-webhook-secret-123";
  const handle=await startBotTransport(bot,{mode:"webhook",port:0,webhookSecret:secret,log:()=>undefined});
  assert.equal(bot.startCalls.length,0);
  assert.equal(bot.deletedWebhook.length,0);

  const health=await fetch(`http://127.0.0.1:${handle.port}/health`);
  assert.equal(health.status,200);
  const denied=await fetch(`http://127.0.0.1:${handle.port}/`,{method:"POST",headers:{"content-type":"application/json","x-telegram-bot-api-secret-token":"wrong"},body:"{}"});
  assert.equal(denied.status,403);
  const accepted=await fetch(`http://127.0.0.1:${handle.port}/`,{method:"POST",headers:{"content-type":"application/json","x-telegram-bot-api-secret-token":secret},body:JSON.stringify({update_id:7})});
  assert.equal(accepted.status,200);
  assert.deepEqual(bot.updates,[{update_id:7}]);

  await handle.stop("test");
  await handle.completion;
});

test("webhook mode refuses to start without a secret",async()=>{
  const bot=new FakeBot();
  await assert.rejects(startBotTransport(bot,{mode:"webhook",port:0}),/TELEGRAM_WEBHOOK_SECRET/);
  assert.equal(bot.startCalls.length,0);
});

test("local Compose selects long polling independently of its health port",async()=>{
  const compose=await readFile(new URL("../docker-compose.yml",import.meta.url),"utf8");
  const index=await readFile(new URL("../apps/bot/src/index.ts",import.meta.url),"utf8");
  assert.match(compose,/TELEGRAM_UPDATE_MODE:\s*long_polling/);
  assert.match(compose,/BOT_HEALTH_PORT:/);
  assert.doesNotMatch(compose,/BOT_WEBHOOK_PORT/);
  assert.match(index,/process\.env\.BOT_HEALTH_PORT/);
  assert.doesNotMatch(index,/process\.env\.BOT_WEBHOOK_PORT/);
});

test("transport logs never include configured Telegram secrets",async()=>{
  const bot=new FakeBot();
  const secret="super-secret-webhook-value";
  const logs:Record<string,unknown>[]=[];
  const handle=await startBotTransport(bot,{mode:"webhook",port:0,webhookSecret:secret,log:entry=>logs.push(entry)});
  await handle.stop("test");
  const serialized=JSON.stringify(logs);
  assert.doesNotMatch(serialized,new RegExp(secret));
});
