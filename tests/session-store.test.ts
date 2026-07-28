import test from "node:test";
import assert from "node:assert/strict";
import { MemoryBotWizardStore } from "../apps/bot/src/session-store.ts";

test("memory wizard store clones data, expires state, and deletes explicitly", async()=>{
  const store=new MemoryBotWizardStore();
  const state={startParam:"partner_safe",attachments:[]};
  await store.set("client",state,60);
  const first=await store.get("client");
  assert.deepEqual(first,state);
  if(first)first.startParam="changed";
  assert.equal((await store.get("client"))?.startParam,"partner_safe");
  await store.delete("client");
  assert.equal(await store.get("client"),undefined);
  await store.set("expired",state,0);
  assert.equal(await store.get("expired"),undefined);
});
