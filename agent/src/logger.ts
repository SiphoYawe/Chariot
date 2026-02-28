interface LogEntry {
  timestamp: string;
  level: string;
  action: string;
  data?: Record<string, unknown>;
  error?: string;
}

export function log(
  level: "info" | "warn" | "error" | "debug",
  action: string,
  data?: Record<string, unknown>,
  error?: unknown,
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    action,
  };

  if (data && Object.keys(data).length > 0) {
    entry.data = data;
  }

  if (error) {
    entry.error = error instanceof Error ? error.message : String(error);
  }

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}
