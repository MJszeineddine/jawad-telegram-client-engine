import { spawnSync } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { resolve } from "node:path";
const backup=process.argv.slice(2).find(argument=>argument!=="--");const target=process.env.RESTORE_DATABASE_URL;const production=process.env.DATABASE_URL;
if(!backup)throw new Error("BACKUP_PATH_REQUIRED");if(!target)throw new Error("RESTORE_DATABASE_URL_REQUIRED");if(production&&target===production)throw new Error("REFUSING_TO_RESTORE_OVER_SOURCE_DATABASE");
const archive=resolve(backup);
const hasPgRestore=spawnSync("pg_restore",["--version"],{stdio:"ignore"}).status===0;
function localComposeDatabaseName(url:string):string|undefined{try{const parsed=new URL(url);if((parsed.hostname==="localhost"||parsed.hostname==="127.0.0.1")&&parsed.port==="55432"&&parsed.username==="jawad")return parsed.pathname.slice(1)||undefined}catch{}}
const targetDb=localComposeDatabaseName(target);
let restore;
if(hasPgRestore)restore=spawnSync("pg_restore",["--clean","--if-exists","--no-owner","--no-privileges","--dbname",target,archive],{stdio:"inherit",env:{...process.env,PGAPPNAME:"jawad-client-engine-restore-test"}});
else if(targetDb){const input=openSync(archive,"r");try{restore=spawnSync("docker",["compose","exec","-T","postgres","pg_restore","--clean","--if-exists","--no-owner","--no-privileges","-U","jawad","-d",targetDb],{stdio:[input,"inherit","inherit"],env:{...process.env,PGAPPNAME:"jawad-client-engine-restore-test"}})}finally{closeSync(input)}}
else restore=spawnSync("pg_restore",["--version"],{stdio:"ignore"});
if(restore.status!==0)throw new Error((restore.error as {code?:string}|undefined)?.code==="ENOENT"?"PG_RESTORE_NOT_AVAILABLE":"RESTORE_FAILED");
const check=hasPgRestore
  ? spawnSync("psql",[target,"-v","ON_ERROR_STOP=1","-Atc","SELECT CASE WHEN to_regclass('public.leads') IS NOT NULL AND to_regclass('public.payment_assignments') IS NOT NULL AND to_regclass('public.audit_log') IS NOT NULL THEN 'RESTORE_OK' ELSE 'RESTORE_INCOMPLETE' END;"],{encoding:"utf8",env:{...process.env,PGAPPNAME:"jawad-client-engine-restore-test"}})
  : targetDb
    ? spawnSync("docker",["compose","exec","-T","postgres","psql","-U","jawad","-d",targetDb,"-v","ON_ERROR_STOP=1","-Atc","SELECT CASE WHEN to_regclass('public.leads') IS NOT NULL AND to_regclass('public.payment_assignments') IS NOT NULL AND to_regclass('public.audit_log') IS NOT NULL THEN 'RESTORE_OK' ELSE 'RESTORE_INCOMPLETE' END;"],{encoding:"utf8",env:{...process.env,PGAPPNAME:"jawad-client-engine-restore-test"}})
    : spawnSync("psql",["--version"],{encoding:"utf8"});
if(check.status!==0||!check.stdout.includes("RESTORE_OK"))throw new Error("RESTORE_SANITY_CHECK_FAILED");
console.log(JSON.stringify({ok:true,archive,targetVerified:true,sourceDatabaseProtected:true,client:hasPgRestore?"host-pg_restore":"docker-compose-postgres"}));
