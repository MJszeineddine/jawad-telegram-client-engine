import { chmod, mkdir, rename, stat, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error("DATABASE_URL_REQUIRED");
const root=process.env.BACKUP_ROOT??join(process.cwd(),"runtime","backups");
await mkdir(root,{recursive:true,mode:0o700});
const stamp=new Date().toISOString().replace(/[:.]/g,"-");
const finalPath=join(root,`jawad-client-engine-${stamp}.dump`);
const temporaryPath=`${finalPath}.partial`;
const result=spawnSync("pg_dump",["--format=custom","--no-owner","--no-privileges","--file",temporaryPath,databaseUrl],{stdio:["ignore","inherit","inherit"],env:{...process.env,PGAPPNAME:"jawad-client-engine-backup"}});
if(result.status!==0){await unlink(temporaryPath).catch(()=>undefined);throw new Error((result.error as {code?:string}|undefined)?.code==="ENOENT"?"PG_DUMP_NOT_INSTALLED":"BACKUP_FAILED")}
await chmod(temporaryPath,0o600);await rename(temporaryPath,finalPath);const metadata=await stat(finalPath);if(metadata.size<1024)throw new Error("BACKUP_TOO_SMALL");
console.log(JSON.stringify({ok:true,path:finalPath,sizeBytes:metadata.size,containsEnvironmentExport:false}));
