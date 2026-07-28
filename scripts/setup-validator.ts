const env=process.env;const errors:string[]=[];const warnings:string[]=[];const production=env.NODE_ENV==="production";const demo=!production&&(env.DEMO_MODE??"true")==="true";if(production&&env.DEMO_MODE==="true")errors.push("DEMO_MODE cannot be enabled when NODE_ENV=production");const placeholder=/(replace-with|example|changeme|not-real)/i;
function requireValue(name:string,minimum=1){const value=env[name];if(!value||value.length<minimum||placeholder.test(value))errors.push(`${name} is missing or still a placeholder`);return value}
function optionalPattern(name:string,pattern:RegExp){const value=env[name];if(value&&!pattern.test(value))errors.push(`${name} has an invalid format`)}
function completePair(left:string,right:string){if(Boolean(env[left])!==Boolean(env[right]))errors.push(`${left} and ${right} must be configured together`)}
function integer(name:string,minimum:number,maximum:number,fallback:number){const value=Number(env[name]??fallback);if(!Number.isInteger(value)||value<minimum||value>maximum)errors.push(`${name} must be an integer between ${minimum} and ${maximum}`)}
function validUrl(name:string,protocols:string[]){const value=env[name];if(!value)return;try{const url=new URL(value);if(!protocols.includes(url.protocol)||url.username||url.password)throw new Error()}catch{errors.push(`${name} must be a valid ${protocols.join("/")} URL without embedded credentials`)}}

optionalPattern("USDT_TRC20_RECEIVING_ADDRESS",/^T[1-9A-HJ-NP-Za-km-z]{33}$/);optionalPattern("USDT_TRC20_TOKEN_CONTRACT",/^T[1-9A-HJ-NP-Za-km-z]{33}$/);optionalPattern("USDC_BASE_RECEIVING_ADDRESS",/^0x[a-fA-F0-9]{40}$/);optionalPattern("USDC_BASE_TOKEN_CONTRACT",/^0x[a-fA-F0-9]{40}$/);completePair("USDT_TRC20_RECEIVING_ADDRESS","USDT_TRC20_TOKEN_CONTRACT");completePair("USDC_BASE_RECEIVING_ADDRESS","USDC_BASE_TOKEN_CONTRACT");
validUrl("APP_BASE_URL",demo?["http:","https:"]:["https:"]);validUrl("MINI_APP_URL",demo?["http:","https:"]:["https:"]);validUrl("BASE_RPC_URL",["https:"]);validUrl("TRON_API_BASE_URL",["https:"]);integer("PAYMENT_CONFIRMATIONS_TRON",1,1_000,20);integer("PAYMENT_CONFIRMATIONS_BASE",1,1_000,12);
if(!demo){
  const session=requireValue("ADMIN_SESSION_SECRET",32);if(session&&new Set(session).size<12)errors.push("ADMIN_SESSION_SECRET lacks sufficient character diversity");
  const key=requireValue("DATA_ENCRYPTION_KEY",40);if(key){try{if(Buffer.from(key,"base64").length!==32)throw new Error()}catch{errors.push("DATA_ENCRYPTION_KEY must decode to exactly 32 bytes")}}
  const passwordHash=requireValue("ADMIN_PASSWORD_SHA256",64);if(passwordHash&&!/^[a-f0-9]{64}$/i.test(passwordHash))errors.push("ADMIN_PASSWORD_SHA256 must be a 64-character SHA-256 hex digest");
  const database=requireValue("DATABASE_URL",12);if(database&&!/^postgres(?:ql)?:\/\//i.test(database))errors.push("DATABASE_URL must use PostgreSQL");
  const redis=requireValue("REDIS_URL",8);if(redis&&!/^rediss?:\/\//i.test(redis))errors.push("REDIS_URL must use Redis");
  const proxyHeader=requireValue("TRUSTED_PROXY_HEADER",5);if(proxyHeader&&!['x-real-ip','cf-connecting-ip','fly-client-ip','true-client-ip'].includes(proxyHeader.toLowerCase()))errors.push("TRUSTED_PROXY_HEADER must name a supported proxy-overwritten client IP header");
  requireValue("TELEGRAM_BOT_TOKEN",20);const webhook=requireValue("TELEGRAM_WEBHOOK_SECRET",16);if(webhook&&!/^[A-Za-z0-9_-]{16,256}$/.test(webhook))errors.push("TELEGRAM_WEBHOOK_SECRET may contain only A-Z, a-z, 0-9, underscore, and hyphen");const chat=requireValue("TELEGRAM_ADMIN_CHAT_ID",1);if(chat&&!/^-?[0-9]+$/.test(chat))errors.push("TELEGRAM_ADMIN_CHAT_ID must be numeric");requireValue("TELEGRAM_BOT_USERNAME",5);
  if(!env.USDT_TRC20_RECEIVING_ADDRESS&&!env.USDC_BASE_RECEIVING_ADDRESS)errors.push("At least one complete receiving network must be configured in production");
  if(env.USDC_BASE_RECEIVING_ADDRESS&&!env.BASE_RPC_URL)errors.push("BASE_RPC_URL is required when Base USDC is enabled");
  if(env.USDT_TRC20_RECEIVING_ADDRESS&&!env.TRON_API_BASE_URL)errors.push("TRON_API_BASE_URL is required when TRON USDT is enabled");
}else{
  if(!env.USDT_TRC20_RECEIVING_ADDRESS&&!env.USDC_BASE_RECEIVING_ADDRESS)warnings.push("No receiving wallet is configured; real invoice generation remains disabled");
  if(!env.BASE_RPC_URL)warnings.push("BASE_RPC_URL is not configured; Base verification remains demo/fixture-only");
  if(!env.TRON_API_KEY)warnings.push("TRON_API_KEY is not configured; authenticated TronGrid capacity is unavailable");
}
for(const warning of warnings)console.warn(`WARN: ${warning}`);if(errors.length){for(const error of errors)console.error(`ERROR: ${error}`);process.exitCode=1}else console.log(`Setup validation PASS (${demo?"demo":"production"} mode)`);
