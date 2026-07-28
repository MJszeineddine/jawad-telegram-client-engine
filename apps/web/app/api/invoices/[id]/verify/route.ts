import { NextResponse } from "next/server";
import { isDemoMode } from "@jawad/config";
import { createPostgresRepository } from "@jawad/database";
import { BaseRpcPaymentProvider,TronGridPaymentProvider } from "@jawad/payments";
import { HttpBodyError,readJsonBody } from "../../../../../lib/http";
import { telegramClient } from "../../../../../lib/telegram-client";
import { allowRequest } from "../../../../../lib/rate-limit";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const client=telegramClient(request);if(!client)return NextResponse.json({error:"INVALID_TELEGRAM_IDENTITY"},{status:401});
  const limit=await allowRequest("payment",client.id);if(!limit.allowed)return NextResponse.json({error:"RATE_LIMITED",retryAfterMs:limit.retryAfterMs},{status:429});
  let body:{txHash?:string};try{body=await readJsonBody(request,8_000)}catch(error){if(error instanceof HttpBodyError)return NextResponse.json({error:error.code},{status:error.status});return NextResponse.json({error:"INVALID_REQUEST"},{status:400})}
  const {id}=await params;const txHash=String(body.txHash??"").trim();if(!/^(?:0x)?[0-9a-f]{64}$/i.test(txHash))return NextResponse.json({error:"INVALID_TRANSACTION_HASH"},{status:422});
  if(isDemoMode())return NextResponse.json({code:"PAYMENT_CONFIRMED",jobId:"demo-paid-job",demo:true,warning:"No chain request was made in demo mode."});
  if(!process.env.DATABASE_URL||!process.env.DATA_ENCRYPTION_KEY)return NextResponse.json({error:"DATABASE_NOT_CONFIGURED"},{status:503});
  const repo=await createPostgresRepository(process.env.DATABASE_URL,process.env.DATA_ENCRYPTION_KEY);
  try{
    const invoice=await repo.getInvoiceForClient(id,client.id);if(!invoice)return NextResponse.json({error:"INVOICE_NOT_FOUND"},{status:404});
    let transfer;let providerName;let confirmations;
    if(invoice.network==="BASE_USDC"){
      if(!process.env.BASE_RPC_URL)return NextResponse.json({error:"BASE_RPC_NOT_CONFIGURED"},{status:503});
      providerName="base-rpc";confirmations=Number(process.env.PAYMENT_CONFIRMATIONS_BASE??12);
      transfer=await new BaseRpcPaymentProvider({rpcUrl:process.env.BASE_RPC_URL,chainId:Number(process.env.BASE_CHAIN_ID??8453)}).fetchTransfer({txHash,recipient:invoice.recipientAddress,tokenContract:invoice.tokenContract});
    }else{
      providerName="trongrid";confirmations=Number(process.env.PAYMENT_CONFIRMATIONS_TRON??20);
      transfer=await new TronGridPaymentProvider({apiBaseUrl:process.env.TRON_API_BASE_URL??"https://api.trongrid.io",...(process.env.TRON_API_KEY?{apiKey:process.env.TRON_API_KEY}:{})}).fetchTransfer({txHash,recipient:invoice.recipientAddress,tokenContract:invoice.tokenContract});
    }
    const result=await repo.confirmPayment({invoiceId:id,transfer,minConfirmations:confirmations,actor:providerName});
    await repo.queueNotification({kind:"Payment confirmed",recipientChatId:client.id,jobId:result.jobId,payload:{text:`Payment was confirmed read-only on chain for invoice ${id}. Paid job ${result.jobId} is now available. No outgoing transfer or automatic refund was performed.`}});
    if(process.env.TELEGRAM_ADMIN_CHAT_ID)await repo.queueNotification({kind:"Payment confirmed",recipientChatId:process.env.TELEGRAM_ADMIN_CHAT_ID,jobId:result.jobId,payload:{summary:`Client-submitted transaction ${transfer.txHash.slice(0,12)}… was verified for invoice ${id}.`,dashboardUrl:`${(process.env.APP_BASE_URL??"").replace(/\/$/,"")}/admin/jobs/${result.jobId}`}});
    return NextResponse.json(result);
  }catch(error){
    const code=error instanceof Error?error.message:"PAYMENT_VERIFICATION_FAILED";
    await repo.recordVerificationFailure(id,txHash,"client-submitted",code,{code}).catch(()=>undefined);
    if(process.env.TELEGRAM_ADMIN_CHAT_ID)await repo.queueNotification({kind:"Payment submitted",recipientChatId:process.env.TELEGRAM_ADMIN_CHAT_ID,payload:{summary:`Transaction verification for invoice ${id} requires attention: ${code}.`,dashboardUrl:`${(process.env.APP_BASE_URL??"").replace(/\/$/,"")}/admin`}}).catch(()=>undefined);
    return NextResponse.json({error:code},{status:409});
  }finally{await repo.close()}
}
