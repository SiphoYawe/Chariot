import "dotenv/config";

interface AgentConfig {
  circleApiKey: string;
  circleEntitySecret: string;
  circleWalletSetId: string;
  circleWalletId: string;
  arcRpcUrl: string;
  monitorIntervalMs: number;
  maxRebalancesPerDay: number;
  minimumUtilityThreshold: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optionalNumericEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const parsed = Number(raw);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid number, got: "${raw}"`);
  }
  return parsed;
}

export function loadConfig(): AgentConfig {
  return {
    circleApiKey: requireEnv("CIRCLE_API_KEY"),
    circleEntitySecret: requireEnv("CIRCLE_ENTITY_SECRET"),
    circleWalletSetId: optionalEnv("CIRCLE_WALLET_SET_ID", ""),
    circleWalletId: optionalEnv("CIRCLE_WALLET_ID", ""),
    arcRpcUrl: requireEnv("ARC_RPC_URL"),
    monitorIntervalMs: optionalNumericEnv("MONITOR_INTERVAL_MS", 60_000),
    maxRebalancesPerDay: optionalNumericEnv("MAX_REBALANCES_PER_DAY", 3),
    minimumUtilityThreshold: optionalNumericEnv("MINIMUM_UTILITY_THRESHOLD", 0.001),
  };
}

export type { AgentConfig };
