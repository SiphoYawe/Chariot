"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useVaultMetrics } from "./useVaultMetrics";
import { type TimePeriod, PERIOD_CUTOFFS, MIN_SNAPSHOT_INTERVAL_MS } from "@/types/charts";

export type { TimePeriod };

export interface SharePriceDataPoint {
  timestamp: number;
  price: number;
}

const STORAGE_KEY = "chariot_share_price_history";
const MAX_SNAPSHOTS = 2592;

function isValidSharePriceDataPoint(v: unknown): v is SharePriceDataPoint {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as SharePriceDataPoint).timestamp === "number" &&
    typeof (v as SharePriceDataPoint).price === "number"
  );
}

function loadSnapshots(): SharePriceDataPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSharePriceDataPoint);
  } catch {
    return [];
  }
}

function saveSnapshots(snapshots: SharePriceDataPoint[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = snapshots.slice(-MAX_SNAPSHOTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // silently ignore
  }
}

function filterByPeriod(data: SharePriceDataPoint[], period: TimePeriod): SharePriceDataPoint[] {
  if (period === "all") return data;
  const now = Date.now();
  const cutoff = now - PERIOD_CUTOFFS[period];
  return data.filter((d) => d.timestamp >= cutoff);
}

export function useSharePriceHistory(period: TimePeriod = "all") {
  const [version, setVersion] = useState(0);
  const [isError, setIsError] = useState(false);
  const snapshotsRef = useRef<SharePriceDataPoint[]>([]);
  const initializedRef = useRef(false);

  const { data: metrics } = useVaultMetrics();

  // Lazy-initialize from localStorage
  if (!initializedRef.current && typeof window !== "undefined") {
    snapshotsRef.current = loadSnapshots();
    initializedRef.current = true;
  }

  // Record new snapshots on each poll cycle
  useEffect(() => {
    if (!metrics) return;

    const snapshot: SharePriceDataPoint = {
      timestamp: Date.now(),
      price: metrics.sharePrice,
    };

    const last = snapshotsRef.current[snapshotsRef.current.length - 1];
    if (!last || snapshot.timestamp - last.timestamp > MIN_SNAPSHOT_INTERVAL_MS) {
      snapshotsRef.current = [...snapshotsRef.current, snapshot];
      saveSnapshots(snapshotsRef.current);
      setVersion((v) => v + 1);
    }
  }, [metrics]);

  const data = useMemo(() => {
    return filterByPeriod(snapshotsRef.current, period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, version]);

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
