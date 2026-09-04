import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;

  try {
    const raw = readFileSync(filePath, "utf-8");

    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;

      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^(["'`])(.*)\1$/, "$2");

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    console.error(`[EnvLoader] Failed to read ${filePath}:`, err);
  }
}

loadEnvFile(resolve(__dirname, ".env"));
loadEnvFile(resolve(__dirname, "..", ".env"));
loadEnvFile(resolve(__dirname, "..", "..", ".env"));
loadEnvFile(resolve(__dirname, "..", "..", "..", ".env"));
