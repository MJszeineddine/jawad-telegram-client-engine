import test from "node:test"; import assert from "node:assert/strict"; import {PaymentLedger,paymentUri,formatToken,buildReceipt,renderReceiptHtml} from "../packages/payments/src/index.ts";
const now=1_000_000; function setup(){const l=new PaymentLedger();const i=l.create({network:"BASE_USDC",token:"USDC",recipient:"0xabc",tokenContract:"0xtoken",amountMinor:100_000_000n,decimals:6,createdAt:now,expiresAt:now+60_000});return {l,i}}; function tx(overrides={}){return {txHash:"0xhash",network:"BASE_USDC" as const,success:true,tokenContract:"0xtoken",from:"0xsender",to:"0xabc",amountMinor:100_000_000n,confirmations:12,timestamp:now+1000,...overrides}}
test("confirms a valid transfer and is idempotent across hash casing",()=>{const {l,i}=setup();assert.equal(l.verifyAndAssign(i.id,tx({txHash:"0xABCDEF"}),12,now+2000).code,"PAYMENT_CONFIRMED");assert.equal(i.txHash,"0xabcdef");assert.equal(l.verifyAndAssign(i.id,tx({txHash:"ABCDEF"}),12,now+2000).code,"ALREADY_PAID_IDEMPOTENT")});
test("rejects every unsafe mismatch",()=>{for(const [over,code] of [[{network:"TRON_TRC20"},"WRONG_NETWORK"],[{success:false},"FAILED_TRANSACTION"],[{tokenContract:"0xwrong"},"WRONG_TOKEN"],[{to:"0xwrong"},"WRONG_RECIPIENT"],[{amountMinor:99n},"INSUFFICIENT_AMOUNT"],[{confirmations:1},"INSUFFICIENT_CONFIRMATIONS"]] as const){const {l,i}=setup();assert.equal(l.verifyAndAssign(i.id,tx(over),12,now+2000).code,code)}});
test("prevents transaction reuse across invoices",()=>{const {l,i}=setup();const i2=l.create({network:"BASE_USDC",token:"USDC",recipient:"0xabc",tokenContract:"0xtoken",amountMinor:100_000_000n,decimals:6,createdAt:now,expiresAt:now+60_000});assert.equal(l.verifyAndAssign(i.id,tx(),12,now+2).ok,true);assert.equal(l.verifyAndAssign(i2.id,tx(),12,now+2).code,"DUPLICATE_TX_HASH")});
test("watcher flags ambiguity and expiry",()=>{const {l,i}=setup();assert.equal(l.matchWatcher(i.id,[tx({txHash:"a"}),tx({txHash:"b"})],12).code,"AMBIGUOUS_MATCH");const x=setup();assert.equal(x.l.verifyAndAssign(x.i.id,tx(),12,now+70_000).code,"INVOICE_EXPIRED")});
test("formats safe payment presentation",()=>{const {i}=setup();assert.equal(formatToken(100_000_000n,6),"100");assert.match(paymentUri(i),/^JAWAD_DEV_DESK_INVOICE\nnetwork=BASE_USDC/);assert.match(paymentUri(i),/warning=Verify every field/)});

test("receipt output is printable, escaped, and evidence-addressable", () => {
  const ledger = new PaymentLedger();
  const invoice = ledger.create({ network:"BASE_USDC",token:"USDC",recipient:"0x000000000000000000000000000000000000dEaD",tokenContract:"0x0000000000000000000000000000000000000001",amountMinor:100_000_000n,decimals:6,createdAt:1,expiresAt:10_000 });
  const receipt = buildReceipt(invoice, { referenceUsdMinor:100_00n });
  const html = renderReceiptHtml({ ...receipt, recipient:"<script>alert(1)</script>" });
  assert.match(html, /Print or save as PDF/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});
