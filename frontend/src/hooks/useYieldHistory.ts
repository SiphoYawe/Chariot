"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useVaultMetrics } from "./useVaultMetrics";
import { useLenderPosition } from "./useLenderPosition";
import { type TimePeriod, PERIOD_CUTOFFS, MIN_SNAPSHOT_INTERVAL_MS } from "@/types/charts";

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
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValidYieldDataPoint);
}

function saveSnapshots(snapshots: YieldDataPoint[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = snapshots.slice(-MAX_SNAPSHOTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable -- silently ignore
  }
}

function filterByPeriod(data: YieldDataPoint[], period: TimePeriod): YieldDataPoint[] {
  if (period === "all") return data;
  const now = Date.now();
  const cutoff = now - PERIOD_CUTOFFS[period];
  return data.filter((d) => d.timestamp >= cutoff);
}

function generateSeedData(): YieldDataPoint[] {
  const now = Date.now();
  const points: YieldDataPoint[] = [];
  const intervals = 720;
  const intervalMs = (30 * 24 * 60 * 60 * 1000) / intervals;

  for (let i = 0; i < intervals; i++) {
    const timestamp = now - (intervals - i) * intervalMs;
    const progress = i / intervals;
    const baseEarnings = progress * 250;
    const noise = Math.sin(i * 0.1) * 5 + Math.cos(i * 0.3) * 3;
    const earnings = Math.max(0, baseEarnings + noise);
    const sharePrice = 1.0 + progress * 0.00025 + Math.sin(i * 0.05) * 0.000005;
    points.push({ timestamp, earnings, sharePrice });
  }

  return points;
}

function getInitialSnapshots(): YieldDataPoint[] {
  try {
    const stored = loadSnapshots();
    if (stored.length > 0) return stored;
  } catch {
    // corrupted localStorage -- fall through to seed
  }
  return generateSeedData();
}

export function useYieldHistory(period: TimePeriod = "7d") {
  const [version, setVersion] = useState(0);
  const [isError, setIsError] = useState(false);
  const snapshotsRef = useRef<YieldDataPoint[] | null>(null);

  const { data: metrics } = useVaultMetrics();
  const { data: position } = useLenderPosition();

  // Lazy-initialize snapshots on first client render (ref mutation only, no side effects)
  if (snapshotsRef.current === null && typeof window !== "undefined") {
    snapshotsRef.current = getInitialSnapshots();
  }

  // Persist seed data on mount if needed
  useEffect(() => {
    if (snapshotsRef.current && snapshotsRef.current.length > 0) {
      saveSnapshots(snapshotsRef.current);
    }
  }, []);

  // Record new snapshots on each poll cycle
  useEffect(() => {
    if (!metrics || !snapshotsRef.current) return;

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
    if (!snapshotsRef.current) return [];
    return filterByPeriod(snapshotsRef.current, period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, version]);

  const isLoading = snapshotsRef.current === null;

  const refetch = useCallback(() => {
    setIsError(false);
    try {
      const stored = loadSnapshots();
      snapshotsRef.current = stored.length > 0 ? stored : generateSeedData();
      saveSnapshots(snapshotsRef.current);
      setVersion((v) => v + 1);
    } catch {
      setIsError(true);
    }
  }, []);

  return { data, isLoading, isError, refetch };
}
