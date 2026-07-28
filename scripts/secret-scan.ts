import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const findings: string[] = [];
const patterns: [RegExp, string][] = [
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
  [/(?:private[_-]?key|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*["']?[0-9a-f]{64}["']?/i, "credential-shaped 64-char hex value"],
  [/^TELEGRAM_BOT_TOKEN\s*=\s*\d{6,}:[A-Za-z0-9_-]{20,}/m, "Telegram token"],
  [/(?:seed|recovery) phrase\s*[:=]\s*\w+/i, "seed phrase"],
];

async function walk(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist", "runtime"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    const rel = relative(root, path);
    if (rel.endsWith(".lock") || rel.includes("tests/telegram.test.ts")) continue;
    let text = "";
    try { text = await readFile(path, "utf8"); } catch { continue; }
    for (const [pattern, name] of patterns) {
      if (!pattern.test(text)) continue;
      if (rel === ".env.example" && name === "Telegram token") continue;
      findings.push(`${rel}: ${name}`);
    }
  }
}

await walk(root);
if (findings.length) {
  console.error(findings.join("\n"));
  process.exit(1);
}
console.log("Secret scan PASS");
