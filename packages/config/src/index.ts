export interface AppConfig { demoMode:boolean; appBaseUrl:string; botToken?:string; adminChatId?:string; tronAddress?:string; baseAddress?:string; }
export function loadConfig(env:NodeJS.ProcessEnv=process.env):AppConfig {
  const demoMode=(env.DEMO_MODE??"true")==="true"; const appBaseUrl=env.APP_BASE_URL??"http://localhost:3100";
  if(!demoMode && !env.ADMIN_SESSION_SECRET?.match(/^.{32,}$/)) throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters");
  if(!demoMode && !env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required outside demo mode");
  return {demoMode,appBaseUrl,...(env.TELEGRAM_BOT_TOKEN?{botToken:env.TELEGRAM_BOT_TOKEN}:{}),...(env.TELEGRAM_ADMIN_CHAT_ID?{adminChatId:env.TELEGRAM_ADMIN_CHAT_ID}:{}),...(env.USDT_TRC20_RECEIVING_ADDRESS?{tronAddress:env.USDT_TRC20_RECEIVING_ADDRESS}:{}),...(env.USDC_BASE_RECEIVING_ADDRESS?{baseAddress:env.USDC_BASE_RECEIVING_ADDRESS}:{})};
}
