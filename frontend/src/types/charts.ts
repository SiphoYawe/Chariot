export type TimePeriod = "24h" | "7d" | "30d" | "all";

export interface TimeSeriesPoint {
  timestamp: number;
}

export const PERIOD_CUTOFFS: Record<Exclude<TimePeriod, "all">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export const MIN_SNAPSHOT_INTERVAL_MS = 30_000;
