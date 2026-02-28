"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useVaultMetrics } from "./useVaultMetrics";
import { MIN_SNAPSHOT_INTERVAL_MS } from "@/types/charts";

export interface ProtocolKPIData {
  tvl: number;
  totalBorrowed: number;
  activePositions: number;
  revenue: number;
  tvlHistory: number[];
  borrowedHistory: number[];
  positionsHistory: number[];
  revenueHistory: number[];
}

interface KPISnapshot {
  timestamp: number;
  tvl: number;
  totalBorrowed: number;
  activePositions: number;
  revenue: number;
}

const STORAGE_KEY = "chariot_kpi_history";
const MAX_SNAPSHOTS = 720; // ~30 days at 1h intervals
const HISTORY_LENGTH = 20; // spark chart data points

function isValidSnapshot(v: unknown): v is KPISnapshot {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as KPISnapshot).timestamp === "number" &&
    typeof (v as KPISnapshot).tvl === "number" &&
    typeof (v as KPISnapshot).totalBorrowed === "number" &&
    typeof (v as KPISnapshot).activePositions === "number" &&
    typeof (v as KPISnapshot).revenue === "number"
  );
}

function loadSnapshots(): KPISnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSnapshot);
  } catch {
    return [];
  }
}

function saveSnapshots(snapshots: KPISnapshot[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = snapshots.slice(-MAX_SNAPSHOTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // silently ignore
  }
}

function generateSeedData(): KPISnapshot[] {
  const now = Date.now();
  const points: KPISnapshot[] = [];
  const intervals = 100;
  const intervalMs = (30 * 24 * 60 * 60 * 1000) / intervals;

  for (let i = 0; i < intervals; i++) {
    const timestamp = now - (intervals - i) * intervalMs;
    const progress = i / intervals;
    // TVL grows from 500K to 1M
    const tvl = 500_000 + progress * 500_000 + Math.sin(i * 0.1) * 20_000;
    // Total borrowed grows from 100K to 450K
    const totalBorrowed = 100_000 + progress * 350_000 + Math.sin(i * 0.15) * 15_000;
    // Active positions grow from 5 to 25
    const activePositions = Math.round(5 + progress * 20 + Math.sin(i * 0.2) * 3);
    // Revenue accumulates
    const revenue = progress * 12_500 + Math.sin(i * 0.05) * 500;
    points.push({ timestamp, tvl, totalBorrowed, activePositions, revenue });
  }

  return points;
}

function getInitialSnapshots(): KPISnapshot[] {
  const stored = loadSnapshots();
  if (stored.length > 0) return stored;
  return generateSeedData();
}

function extractHistory(snapshots: KPISnapshot[], key: keyof Omit<KPISnapshot, "timestamp">): number[] {
  const recent = snapshots.slice(-HISTORY_LENGTH);
  return recent.map((s) => s[key]);
}

export function useProtocolKPIs() {
  const [version, setVersion] = useState(0);
  const [isError, setIsError] = useState(false);
  const snapshotsRef = useRef<KPISnapshot[] | null>(null);

  const { data: metrics } = useVaultMetrics();

  // Lazy-initialize
  if (snapshotsRef.current === null && typeof window !== "undefined") {
    snapshotsRef.current = getInitialSnapshots();
  }

  // Persist on mount
  useEffect(() => {
    if (snapshotsRef.current && snapshotsRef.current.length > 0) {
      saveSnapshots(snapshotsRef.current);
    }
  }, []);

  // Record new snapshots
  useEffect(() => {
    if (!metrics || !snapshotsRef.current) return;

    const snapshot: KPISnapshot = {
      timestamp: Date.now(),
      tvl: metrics.totalAssets,
      totalBorrowed: metrics.totalBorrowed,
      activePositions: 18, // mock -- would come from event indexing
      revenue: 8_750, // mock -- would come from fee accumulator
    };

    const last = snapshotsRef.current[snapshotsRef.current.length - 1];
    if (!last || snapshot.timestamp - last.timestamp > MIN_SNAPSHOT_INTERVAL_MS) {
      snapshotsRef.current = [...snapshotsRef.current, snapshot];
      saveSnapshots(snapshotsRef.current);
      setVersion((v) => v + 1);
    }
  }, [metrics]);

  const data = useMemo((): ProtocolKPIData | null => {
    if (!snapshotsRef.current || snapshotsRef.current.length === 0) return null;
    const latest = snapshotsRef.current[snapshotsRef.current.length - 1];
    return {
      tvl: latest.tvl,
      totalBorrowed: latest.totalBorrowed,
      activePositions: latest.activePositions,
      revenue: latest.revenue,
      tvlHistory: extractHistory(snapshotsRef.current, "tvl"),
      borrowedHistory: extractHistory(snapshotsRef.current, "totalBorrowed"),
      positionsHistory: extractHistory(snapshotsRef.current, "activePositions"),
      revenueHistory: extractHistory(snapshotsRef.current, "revenue"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

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
