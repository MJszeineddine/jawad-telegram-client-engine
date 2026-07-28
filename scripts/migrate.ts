import { access,mkdtemp,readFile,rm,writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root=new URL("..",import.meta.url).pathname;
const files=[
  "packages/database/migrations/001_initial.sql",
  "packages/database/migrations/002_security.sql",
  "packages/database/migrations/003_operations.sql",
  "packages/database/migrations/004_reliability.sql",
  "packages/database/migrations/005_monitor_controls.sql",
  "packages/database/migrations/006_quote_delivery_fields.sql",
  "packages/database/migrations/007_group_monitor_categories.sql",
  "packages/database/migrations/008_job_operations.sql",
  "packages/database/migrations/009_partner_operations.sql",
  "packages/database/migrations/010_partner_fraud_controls.sql",
  "packages/database/migrations/011_acceptance_evidence.sql",
  "packages/database/migrations/012_sensitive_data_and_attribution.sql",
  "packages/database/migrations/013_financial_integrity.sql",
];
if(new Set(files).size!==files.length)throw new Error("DUPLICATE_MIGRATION_ENTRY");
const migrations: Array<{name:string;body:string}>=[];
for(const file of files){const path=join(root,file);await access(path);const sql=await readFile(path,"utf8");if(!/^\s*BEGIN;/i.test(sql)||!/COMMIT;\s*$/i.test(sql))throw new Error(`${file} is not transactional`);migrations.push({name:file.split("/").at(-1)!,body:sql.replace(/^\s*BEGIN;\s*/i,"").replace(/\s*COMMIT;\s*$/i,"")})}
const databaseUrl=process.env.DATABASE_URL;
const hasPsql=spawnSync("psql",["--version"],{stdio:"ignore"}).status===0;
if(!databaseUrl||!hasPsql){console.log(`Migration SQL validation PASS; ${!databaseUrl?"DATABASE_URL is not configured":"psql is not installed in this sandbox"}.`);process.exit(0)}
const bootstrap=spawnSync("psql",[databaseUrl,"-v","ON_ERROR_STOP=1","-c","CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now());"],{stdio:"inherit"});if(bootstrap.status!==0)process.exit(bootstrap.status??1);
const temp=await mkdtemp(join(tmpdir(),"jawad-migrations-"));
try{for(const migration of migrations){const check=spawnSync("psql",[databaseUrl,"-At","-v","ON_ERROR_STOP=1","-c",`SELECT 1 FROM schema_migrations WHERE name='${migration.name.replaceAll("'","''")}' LIMIT 1;`],{encoding:"utf8"});if(check.status!==0)process.exit(check.status??1);if(check.stdout.trim()==="1"){console.log(`Migration SKIP ${migration.name}`);continue}const wrapper=join(temp,migration.name);await writeFile(wrapper,`BEGIN;\n${migration.body}\nINSERT INTO schema_migrations(name) VALUES('${migration.name.replaceAll("'","''")}');\nCOMMIT;\n`,{mode:0o600});const result=spawnSync("psql",[databaseUrl,"-v","ON_ERROR_STOP=1","-f",wrapper],{stdio:"inherit"});if(result.status!==0)process.exit(result.status??1);console.log(`Migration APPLIED ${migration.name}`)}}finally{await rm(temp,{recursive:true,force:true})}
