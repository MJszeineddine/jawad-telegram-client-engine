import { validateTelegramInitData } from "@jawad/telegram";

export interface TelegramClientIdentity { id:string; username?:string }
export function telegramClient(request:Request):TelegramClientIdentity|null{
  if((process.env.DEMO_MODE??"true")==="true")return{id:"10001",username:"demo_client"};
  const token=process.env.TELEGRAM_BOT_TOKEN;if(!token)return null;
  const result=validateTelegramInitData(request.headers.get("x-telegram-init-data")??"",token);
  return result.ok&&result.user?result.user:null;
}
