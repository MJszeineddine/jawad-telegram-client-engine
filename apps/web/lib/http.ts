export class HttpBodyError extends Error {
  readonly code:string;
  readonly status:number;
  constructor(code:string,status:number){super(code);this.code=code;this.status=status}
}

export async function readJsonBody<T>(request:Request,maxBytes=64_000):Promise<T>{
  const contentType=request.headers.get("content-type")?.toLowerCase()??"";
  if(!contentType.startsWith("application/json"))throw new HttpBodyError("JSON_REQUIRED",415);
  const declared=Number(request.headers.get("content-length")??0);
  if(Number.isFinite(declared)&&declared>maxBytes)throw new HttpBodyError("BODY_TOO_LARGE",413);
  const reader=request.body?.getReader();
  if(!reader)throw new HttpBodyError("EMPTY_BODY",400);
  const chunks:Uint8Array[]=[];let total=0;
  try{
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      total+=value.byteLength;if(total>maxBytes)throw new HttpBodyError("BODY_TOO_LARGE",413);
      chunks.push(value);
    }
  }finally{reader.releaseLock()}
  if(total===0)throw new HttpBodyError("EMPTY_BODY",400);
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  try{return JSON.parse(new TextDecoder().decode(bytes)) as T}catch{throw new HttpBodyError("INVALID_JSON",400)}
}
