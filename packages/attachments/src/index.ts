import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { redactSecrets, validateAttachment } from "../../telegram/src/index.ts";

export interface StoredAttachment { id:string; storagePath:string; originalName:string; safeName:string; mime:string; size:number; sha256:string; scanStatus:"clean"|"unavailable"; redactedPreview?:string; deleteAfter:number; }
function matchesDeclaredType(mime:string,bytes:Buffer){if(mime==="image/png")return bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));if(mime==="image/jpeg")return bytes.length>=4&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes.at(-2)===0xff&&bytes.at(-1)===0xd9;if(mime==="image/webp")return bytes.subarray(0,4).toString("ascii")==="RIFF"&&bytes.subarray(8,12).toString("ascii")==="WEBP";if(mime==="application/pdf")return bytes.subarray(0,5).toString("ascii")==="%PDF-";if(mime==="application/zip"||mime==="application/x-zip-compressed")return bytes.length>=4&&bytes[0]===0x50&&bytes[1]===0x4b&&[0x03,0x05,0x07].includes(bytes[2]??-1)&&[0x04,0x06,0x08].includes(bytes[3]??-1);if(mime==="text/plain")return !bytes.subarray(0,32_000).includes(0);return false}
export class LocalAttachmentStore {
  private readonly root:string;
  constructor(root:string){this.root=resolve(root)}
  async save(input:{name:string;mime:string;bytes:Buffer;retentionDays?:number}):Promise<StoredAttachment>{
    const validation=validateAttachment({name:input.name,mime:input.mime,size:input.bytes.length}); if(!validation.ok)throw new Error(`ATTACHMENT_REJECTED:${validation.errors.join(",")}`);if(!matchesDeclaredType(input.mime,input.bytes))throw new Error("ATTACHMENT_CONTENT_MISMATCH");
    await mkdir(this.root,{recursive:true,mode:0o700}); const id=randomUUID(); const storagePath=join(this.root,`${id}.bin`); if(!resolve(storagePath).startsWith(this.root))throw new Error("INVALID_STORAGE_PATH"); await writeFile(storagePath,input.bytes,{mode:0o600});
    const sha256=createHash("sha256").update(input.bytes).digest("hex"); const scan=spawnSync("clamscan",["--no-summary",storagePath],{stdio:"ignore"});let scanStatus:"clean"|"unavailable";if(scan.error)scanStatus="unavailable";else if(scan.status===0)scanStatus="clean";else{await unlink(storagePath).catch(()=>undefined);throw new Error("MALWARE_SCAN_REJECTED")}
    const preview=/^text\//.test(input.mime)?redactSecrets(input.bytes.subarray(0,32_000).toString("utf8")):undefined;
    return{id,storagePath,originalName:input.name.slice(0,255),safeName:validation.safeName,mime:input.mime,size:input.bytes.length,sha256,scanStatus,...(preview?{redactedPreview:preview}:{}),deleteAfter:Date.now()+(input.retentionDays??30)*86_400_000};
  }
  async read(record:StoredAttachment){const path=resolve(record.storagePath);if(!path.startsWith(this.root))throw new Error("OUTSIDE_ATTACHMENT_ROOT");return readFile(path)}
  async delete(record:StoredAttachment){const path=resolve(record.storagePath);if(!path.startsWith(this.root))throw new Error("OUTSIDE_ATTACHMENT_ROOT");await unlink(path)}
  async readStorageKey(storageKey:string){if(!/^[a-f0-9-]{36}\.bin$/i.test(storageKey))throw new Error("INVALID_STORAGE_KEY");const path=resolve(join(this.root,storageKey));if(!path.startsWith(this.root))throw new Error("OUTSIDE_ATTACHMENT_ROOT");return readFile(path)}
  async deleteStorageKey(storageKey:string){if(!/^[a-f0-9-]{36}\.bin$/i.test(storageKey))throw new Error("INVALID_STORAGE_KEY");const path=resolve(join(this.root,storageKey));if(!path.startsWith(this.root))throw new Error("OUTSIDE_ATTACHMENT_ROOT");try{await unlink(path)}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error}}
}
