import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const patterns: [RegExp, string][] = [
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
  [/(?:private[_-]?key|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*["']?[0-9a-f]{64}["']?/i, "credential-shaped 64-char hex value"],
  [/(?:TELEGRAM_BOT_TOKEN\s*=\s*)?\d{6,}:[A-Za-z0-9_-]{20,}/, "Telegram token"],
  [/(?:seed|recovery) phrase\s*[:=]\s*\w+/i, "seed phrase"],
];
const skippedDirectories = new Set([".git", "node_modules", "dist", "runtime", ".next", "uploads", "coverage"]);

export interface SecretFinding {
  file: string;
  kind: string;
}

function isSkippedEnvironmentFile(rel: string): boolean {
  return rel === ".env" || (rel.startsWith(".env.") && rel !== ".env.example");
}

async function fallbackWalk(root: string, directory: string, output: string[]): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const rel = relative(root, path);
    if (entry.isDirectory()) {
      if (skippedDirectories.has(entry.name)) continue;
      await fallbackWalk(root, path, output);
    } else if (!isSkippedEnvironmentFile(rel)) {
      output.push(rel);
    }
  }
}

export async function candidateFiles(root: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      { cwd: root, encoding: "buffer", maxBuffer: 16 * 1024 * 1024 },
    );
    return Buffer.from(stdout).toString("utf8").split("\0").filter(Boolean);
  } catch {
    const output: string[] = [];
    await fallbackWalk(root, root, output);
    return output;
  }
}

export async function scanSecrets(root: string): Promise<SecretFinding[]> {
  const findings: SecretFinding[] = [];
  for (const rel of await candidateFiles(root)) {
    if (rel.endsWith(".lock") || isSkippedEnvironmentFile(rel)) continue;
    let text = "";
    try { text = await readFile(join(root, rel), "utf8"); } catch { continue; }
    for (const [pattern, kind] of patterns) {
      pattern.lastIndex = 0;
      if (!pattern.test(text)) continue;
      findings.push({ file: rel, kind });
    }
  }
  return findings;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = new URL("..", import.meta.url).pathname;
  const findings = await scanSecrets(root);
  if (findings.length) {
    console.error(findings.map(finding => `${finding.file}: ${finding.kind}`).join("\n"));
    process.exit(1);
  }
  console.log("Secret scan PASS");
}
