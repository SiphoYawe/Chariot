"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useVaultMetrics } from "./useVaultMetrics";
import { useLenderPosition } from "./useLenderPosition";
import { type TimePeriod, PERIOD_CUTOFFS, MIN_SNAPSHOT_INTERVAL_MS } from "@/types/charts";
import {
  generateSeedData,
  MIN_SNAPSHOTS_FOR_CHART,
  SEED_SPANS,
  SEED_COUNTS,
} from "@/lib/chartSeed";

export type { TimePeriod };

export interface YieldDataPoint {
  timestamp: number;
  earnings: number;
  sharePrice: number;
}

const STORAGE_KEY = "chariot_yield_history";
const MAX_SNAPSHOTS = 2592;

function isValidYieldDataPoint(v: unknown): v is YieldDataPoint {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as YieldDataPoint).timestamp === "number" &&
    typeof (v as YieldDataPoint).earnings === "number" &&
    typeof (v as YieldDataPoint).sharePrice === "number"
  );
}

function loadSnapshots(): YieldDataPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidYieldDataPoint);
  } catch {
    return [];
  }
}

function saveSnapshots(snapshots: YieldDataPoint[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = snapshots.slice(-MAX_SNAPSHOTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // silently ignore
  }
}

function filterByPeriod(data: YieldDataPoint[], period: TimePeriod): YieldDataPoint[] {
  if (period === "all") return data;
  const now = Date.now();
  const cutoff = now - PERIOD_CUTOFFS[period];
  return data.filter((d) => d.timestamp >= cutoff);
}

function buildSeed(
  currentEarnings: number,
  sharePrice: number,
  period: TimePeriod
): YieldDataPoint[] {
  const seed = generateSeedData({
    count: SEED_COUNTS[period] ?? 28,
    spanMs: SEED_SPANS[period] ?? SEED_SPANS["7d"],
    endValue: currentEarnings,
    startValue: 0,
    noise: 0.03,
    seed: 202,
  });
  return seed.map((p) => ({
    timestamp: p.timestamp,
    earnings: Math.max(0, p.value),
    sharePrice,
  }));
}

export function useYieldHistory(period: TimePeriod = "7d") {
  const [version, setVersion] = useState(0);
  const [isError, setIsError] = useState(false);
  const snapshotsRef = useRef<YieldDataPoint[]>([]);
  const initializedRef = useRef(false);

  const { data: metrics } = useVaultMetrics();
  const { data: position } = useLenderPosition();

  // Lazy-initialize from localStorage
  if (!initializedRef.current && typeof window !== "undefined") {
    snapshotsRef.current = loadSnapshots();
    initializedRef.current = true;
  }

  // Record new snapshots on each poll cycle
  useEffect(() => {
    if (!metrics) return;

    const snapshot: YieldDataPoint = {
      timestamp: Date.now(),
      earnings: position?.accruedEarnings ?? 0,
      sharePrice: metrics.sharePrice,
    };

    const last = snapshotsRef.current[snapshotsRef.current.length - 1];
    if (!last || snapshot.timestamp - last.timestamp > MIN_SNAPSHOT_INTERVAL_MS) {
      snapshotsRef.current = [...snapshotsRef.current, snapshot];
      saveSnapshots(snapshotsRef.current);
      setVersion((v) => v + 1);
    }
  }, [metrics, position]);

  const data = useMemo(() => {
    const filtered = filterByPeriod(snapshotsRef.current, period);
    if (filtered.length < MIN_SNAPSHOTS_FOR_CHART && metrics) {
      return buildSeed(
        position?.accruedEarnings ?? 0,
        metrics.sharePrice,
        period
      );
    }
    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, version, metrics, position]);

  const refetch = useCallback(() => {
    setIsError(false);
    try {
      snapshotsRef.current = loadSnapshots();
      setVersion((v) => v + 1);
    } catch {
      setIsError(true);
    }
  }, []);

  return { data, isLoading: false, isError, refetch };
}
