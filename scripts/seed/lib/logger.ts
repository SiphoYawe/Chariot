// chariot/scripts/seed/lib/logger.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = path.resolve(__dirname, "../seed.log");

interface LogEntry {
  label: string;
  hash: string;
  status: "success" | "failed";
  note?: string;
}

export function appendLog(entry: LogEntry) {
  const row = `${new Date().toISOString()},${entry.status},${entry.hash},${entry.label}${entry.note ? "," + entry.note : ""}\n`;
  fs.appendFileSync(LOG_PATH, row);
}

export function banner(msg: string) {
  const line = "=".repeat(60);
  console.log(`\n${line}\n  ${msg}\n${line}`);
}
