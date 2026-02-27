type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  action: string;
  data?: Record<string, unknown>;
  error?: string;
}

function log(level: LogLevel, action: string, data?: Record<string, unknown>, error?: string): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    action,
    ...(data && { data }),
    ...(error && { error }),
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (action: string, data?: Record<string, unknown>) => log("info", action, data),
  warn: (action: string, data?: Record<string, unknown>) => log("warn", action, data),
  error: (action: string, data?: Record<string, unknown>, error?: string) => log("error", action, data, error),
  debug: (action: string, data?: Record<string, unknown>) => log("debug", action, data),
};
