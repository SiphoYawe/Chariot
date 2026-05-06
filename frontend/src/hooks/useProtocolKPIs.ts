"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useReadContract } from "wagmi";
import {
  ChariotVaultABI,
  LendingPoolABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
  USDC_ERC20_DECIMALS,
} from "@chariot/shared";
import { MIN_SNAPSHOT_INTERVAL_MS } from "@/types/charts";

export interface ProtocolKPIData {
  tvl: number;
  totalBorrowed: number;
  totalIdle: number;
  utilisationRate: number;
  tvlHistory: number[];
  borrowedHistory: number[];
  idleHistory: number[];
  utilisationHistory: number[];
}

interface KPISnapshot {
  timestamp: number;
  tvl: number;
  totalBorrowed: number;
  totalIdle: number;
  utilisationRate: number;
}

const USDC_DIVISOR = 10 ** USDC_ERC20_DECIMALS;
const STORAGE_KEY = "chariot_kpi_history";
const MAX_SNAPSHOTS = 720;
const HISTORY_LENGTH = 20;

function isValidSnapshot(v: unknown): v is KPISnapshot {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as KPISnapshot).timestamp === "number" &&
    typeof (v as KPISnapshot).tvl === "number" &&
    typeof (v as KPISnapshot).totalBorrowed === "number"
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

function extractHistory(
  snapshots: KPISnapshot[],
  key: keyof Omit<KPISnapshot, "timestamp">
): number[] {
  const recent = snapshots.slice(-HISTORY_LENGTH);
  return recent.map((s) => s[key]);
}

/**
 * Hook for protocol KPIs.
 * Reads vault.totalAssets (TVL), lendingPool.getTotalBorrowed,
 * lendingPool.getTotalReserves (revenue proxy).
 * Maintains a localStorage-backed history for spark charts.
 * Only real on-chain data is used -- no simulated/seed data.
 */
export function useProtocolKPIs() {
  const [version, setVersion] = useState(0);
  const [isError, setIsError] = useState(false);
  const snapshotsRef = useRef<KPISnapshot[]>([]);
  const initializedRef = useRef(false);

  // Read TVL (totalAssets)
  const {
    data: rawTotalAssets,
    isLoading: loadingAssets,
    isError: errorAssets,
    refetch: refetchAssets,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "totalAssets",
    query: { refetchInterval: POLLING_INTERVAL_MS },
  });

  // Read totalBorrowed
  const {
    data: rawTotalBorrowed,
    isLoading: loadingBorrowed,
    isError: errorBorrowed,
    refetch: refetchBorrowed,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getTotalBorrowed",
    query: { refetchInterval: POLLING_INTERVAL_MS },
  });

  // Lazy-initialize from localStorage
  if (!initializedRef.current && typeof window !== "undefined") {
    snapshotsRef.current = loadSnapshots();
    initializedRef.current = true;
  }

  // Record new snapshots when contract data updates
  useEffect(() => {
    if (rawTotalAssets === undefined || rawTotalBorrowed === undefined) return;

    const tvl = Number(rawTotalAssets) / USDC_DIVISOR;
    const totalBorrowed = Number(rawTotalBorrowed) / USDC_DIVISOR;
    const totalIdle = Math.max(0, tvl - totalBorrowed);
    const utilisationRate = tvl > 0 ? (totalBorrowed / tvl) * 100 : 0;

    const snapshot: KPISnapshot = {
      timestamp: Date.now(),
      tvl,
      totalBorrowed,
      totalIdle,
      utilisationRate,
    };

    const last = snapshotsRef.current[snapshotsRef.current.length - 1];
    if (!last || snapshot.timestamp - last.timestamp > MIN_SNAPSHOT_INTERVAL_MS) {
      snapshotsRef.current = [...snapshotsRef.current, snapshot];
      saveSnapshots(snapshotsRef.current);
      setVersion((v) => v + 1);
    }
  }, [rawTotalAssets, rawTotalBorrowed]);

  const contractError = errorAssets || errorBorrowed;

  const data = useMemo((): ProtocolKPIData | null => {
    if (rawTotalAssets === undefined || rawTotalBorrowed === undefined) {
      if (snapshotsRef.current.length > 0) {
        const latest = snapshotsRef.current[snapshotsRef.current.length - 1];
        const hist = snapshotsRef.current;
        return {
          tvl: latest.tvl,
          totalBorrowed: latest.totalBorrowed,
          totalIdle: latest.totalIdle ?? Math.max(0, latest.tvl - latest.totalBorrowed),
          utilisationRate: latest.utilisationRate ?? (latest.tvl > 0 ? (latest.totalBorrowed / latest.tvl) * 100 : 0),
          tvlHistory: extractHistory(hist, "tvl"),
          borrowedHistory: extractHistory(hist, "totalBorrowed"),
          idleHistory: hist.slice(-HISTORY_LENGTH).map((s) => s.totalIdle ?? Math.max(0, s.tvl - s.totalBorrowed)),
          utilisationHistory: hist.slice(-HISTORY_LENGTH).map((s) => s.utilisationRate ?? (s.tvl > 0 ? (s.totalBorrowed / s.tvl) * 100 : 0)),
        };
      }
      return null;
    }

    const tvl = Number(rawTotalAssets) / USDC_DIVISOR;
    const totalBorrowed = Number(rawTotalBorrowed) / USDC_DIVISOR;
    const totalIdle = Math.max(0, tvl - totalBorrowed);
    const utilisationRate = tvl > 0 ? (totalBorrowed / tvl) * 100 : 0;

    const snapshots = snapshotsRef.current;

    return {
      tvl,
      totalBorrowed,
      totalIdle,
      utilisationRate,
      tvlHistory: extractHistory(snapshots, "tvl"),
      borrowedHistory: extractHistory(snapshots, "totalBorrowed"),
      idleHistory: snapshots.slice(-HISTORY_LENGTH).map((s) => s.totalIdle ?? Math.max(0, s.tvl - s.totalBorrowed)),
      utilisationHistory: snapshots.slice(-HISTORY_LENGTH).map((s) => s.utilisationRate ?? (s.tvl > 0 ? (s.totalBorrowed / s.tvl) * 100 : 0)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTotalAssets, rawTotalBorrowed, version]);

  const isLoading = loadingAssets || loadingBorrowed;

  const refetch = useCallback(() => {
    setIsError(false);
    refetchAssets();
    refetchBorrowed();
  }, [refetchAssets, refetchBorrowed]);

  return { data, isLoading, isError: isError || contractError, refetch };
}
