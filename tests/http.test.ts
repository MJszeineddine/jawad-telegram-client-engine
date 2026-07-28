import test from "node:test";
import assert from "node:assert/strict";
import { HttpBodyError,readJsonBody } from "../apps/web/lib/http.ts";

test("bounded JSON reader accepts valid JSON",async()=>{
  const request=new Request("https://example.test",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({ok:true})});
  assert.deepEqual(await readJsonBody(request,100),{ok:true});
});

test("bounded JSON reader rejects wrong content type, invalid JSON, and streamed overflow",async()=>{
  await assert.rejects(()=>readJsonBody(new Request("https://example.test",{method:"POST",headers:{"content-type":"text/plain"},body:"{}"}),100),(error:unknown)=>error instanceof HttpBodyError&&error.code==="JSON_REQUIRED"&&error.status===415);
  await assert.rejects(()=>readJsonBody(new Request("https://example.test",{method:"POST",headers:{"content-type":"application/json"},body:"{"}),100),(error:unknown)=>error instanceof HttpBodyError&&error.code==="INVALID_JSON");
  const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new TextEncoder().encode('{"x":"'));controller.enqueue(new Uint8Array(200));controller.close()}});
  await assert.rejects(()=>readJsonBody(new Request("https://example.test",{method:"POST",headers:{"content-type":"application/json"},body:stream,duplex:"half"} as RequestInit),50),(error:unknown)=>error instanceof HttpBodyError&&error.code==="BODY_TOO_LARGE"&&error.status===413);
});
