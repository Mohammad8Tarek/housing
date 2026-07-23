import * as fs from "fs";
import * as path from "path";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const COLORS = { debug: "\x1b[90m", info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m", reset: "\x1b[0m" };

let currentLevel: LogLevel = "info";
let logFilePath: string | null = null;
let logStream: fs.WriteStream | null = null;

export function initLogger(level: LogLevel, logFile?: string) {
  currentLevel = level;
  if (logFile) {
    const dir = path.dirname(logFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    logFilePath = logFile;
    logStream = fs.createWriteStream(logFile, { flags: "a" });
  }
}

function write(level: LogLevel, msg: string) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel]) return;
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase().padEnd(5)}] ${msg}`;

  // Console with color
  const color = COLORS[level] || "";
  console.log(`${color}${line}${COLORS.reset}`);

  // File without color
  if (logStream) logStream.write(line + "\n");
}

export const log = {
  debug: (msg: string) => write("debug", msg),
  info: (msg: string) => write("info", msg),
  warn: (msg: string) => write("warn", msg),
  error: (msg: string) => write("error", msg),
  separator: () => {
    const line = "─".repeat(60);
    console.log(`\x1b[90m${line}\x1b[0m`);
    if (logStream) logStream.write(line + "\n");
  },
};
