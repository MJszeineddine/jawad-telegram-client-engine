import { readFile } from "node:fs/promises";
const expected: Record<string, Record<string,string>> = {
  "apps/web/package.json": { next:"16.2.12", react:"19.2.8", "react-dom":"19.2.8", zod:"4.4.3", qrcode:"1.5.4" },
  "apps/bot/package.json": { grammy:"1.45.1" },
  "apps/worker/package.json": { bullmq:"5.79.3", ioredis:"5.11.1" },
  "packages/database/package.json": { postgres:"3.4.9" },
};
for (const [file, versions] of Object.entries(expected)) {
  const pkg = JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), "utf8"));
  for (const [name, version] of Object.entries(versions)) if (pkg.dependencies?.[name] !== version) throw new Error(`${file}: expected ${name}@${version}`);
  for (const group of [pkg.dependencies, pkg.devDependencies]) for (const [name, version] of Object.entries(group ?? {})) if (["latest","*"].includes(String(version))) throw new Error(`${file}: unpinned dependency ${name}@${version}`);
}
console.log("Dependency policy PASS. Registry vulnerability audit runs in connected CI.");
