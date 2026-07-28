import { createServer } from "node:http";
import { isDemoMode } from "../../../packages/config/src/index.ts";
import { processQueueJob } from "./core.ts";
import { startBullMqRuntime } from "./bullmq-adapter.ts";

const demo=isDemoMode();
const healthPort=Number(process.env.WORKER_HEALTH_PORT??3002);
let ready=demo;
createServer((request,response)=>{
  if(request.url!=="/health"){response.writeHead(404).end();return}
  response.writeHead(ready?200:503,{"content-type":"application/json","cache-control":"no-store"});
  response.end(JSON.stringify({ok:ready,ready,service:"worker",mode:demo?"demo":"production"}));
}).listen(healthPort,()=>console.log(JSON.stringify({level:"info",service:"worker-health",port:healthPort})));

if(demo){
  console.log(JSON.stringify(processQueueJob({id:"demo-worker",type:"PAYMENT_WATCH",payload:{mode:"mock"},attempts:0})));
}else{
  const redisUrl=process.env.REDIS_URL;
  const databaseUrl=process.env.DATABASE_URL;
  const dataEncryptionKey=process.env.DATA_ENCRYPTION_KEY;
  if(!redisUrl||!databaseUrl||!dataEncryptionKey)throw new Error("REDIS_URL, DATABASE_URL, and DATA_ENCRYPTION_KEY are required outside demo mode");
  await startBullMqRuntime({
    redisUrl,databaseUrl,dataEncryptionKey,
    attachmentRoot:process.env.ATTACHMENT_ROOT??"./runtime/uploads",
    dashboardUrl:process.env.APP_BASE_URL??"http://localhost:3000/admin",
    ...(process.env.TELEGRAM_BOT_TOKEN?{telegramBotToken:process.env.TELEGRAM_BOT_TOKEN}:{}),
    ...(process.env.TELEGRAM_ADMIN_CHAT_ID?{telegramAdminChatId:process.env.TELEGRAM_ADMIN_CHAT_ID}:{}),
    ...(process.env.BASE_RPC_URL?{baseRpcUrl:process.env.BASE_RPC_URL}:{}),
    baseChainId:Number(process.env.BASE_CHAIN_ID??8453),
    tronApiBaseUrl:process.env.TRON_API_BASE_URL??"https://api.trongrid.io",
    ...(process.env.TRON_API_KEY?{tronApiKey:process.env.TRON_API_KEY}:{}),
    paymentConfirmationsBase:Number(process.env.PAYMENT_CONFIRMATIONS_BASE??12),
    paymentConfirmationsTron:Number(process.env.PAYMENT_CONFIRMATIONS_TRON??20),
  });
  ready=true;
  console.log(JSON.stringify({level:"info",service:"worker",event:"runtime-ready"}));
}
