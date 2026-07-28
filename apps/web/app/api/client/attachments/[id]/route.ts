import { LocalAttachmentStore } from "@jawad/attachments";
import { createPostgresRepository } from "@jawad/database";
import { telegramClient } from "../../../../../lib/telegram-client";

function downloadName(value:string){return value.replace(/[\r\n"\\/]/g,"_").slice(0,120)||"proof.bin"}

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const client=telegramClient(request);if(!client)return new Response("Invalid Telegram identity",{status:401,headers:{"cache-control":"no-store"}});
  if(process.env.NODE_ENV!=="production"&&(process.env.DEMO_MODE??"true")==="true")return new Response("Synthetic proof attachment",{headers:{"content-type":"text/plain","content-disposition":"attachment; filename=demo-proof.txt","cache-control":"no-store","x-content-type-options":"nosniff"}});
  if(!process.env.DATABASE_URL||!process.env.DATA_ENCRYPTION_KEY)return new Response("Database not configured",{status:503});
  const {id}=await params;const repo=await createPostgresRepository(process.env.DATABASE_URL,process.env.DATA_ENCRYPTION_KEY);
  try{const attachment=await repo.getAttachmentForClient(id,client.id);if(!attachment)return new Response("Not found",{status:404,headers:{"cache-control":"no-store"}});if(attachment.scanStatus!=="clean"&&attachment.scanStatus!=="unavailable")return new Response("Attachment is quarantined",{status:423});const bytes=await new LocalAttachmentStore(process.env.ATTACHMENT_ROOT??"./runtime/uploads").readStorageKey(attachment.storageKey);const body=new Uint8Array(bytes.length);body.set(bytes);return new Response(body.buffer,{headers:{"content-type":attachment.mime,"content-length":String(bytes.length),"content-disposition":`attachment; filename="${downloadName(attachment.safeName)}"`,"cache-control":"private, no-store","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; sandbox"}})}finally{await repo.close()}
}
