"use client";

import { useState, useEffect, useCallback } from "react";
import { CHARIOT_ADDRESSES } from "@chariot/shared";

const ARCSCAN_API = "https://testnet.arcscan.app/api";

export interface ActivityBucket {
  /** ISO date string for this day bucket, e.g. "2026-05-06" */
  date: string;
  /** Hour 0-23 */
  hour: number;
  /** Number of transactions in this bucket */
  count: number;
}

interface RawLog {
  timeStamp: string; // hex unix seconds
}

async function fetchLogs(address: string): Promise<RawLog[]> {
  try {
    const res = await fetch(
      `${ARCSCAN_API}?module=logs&action=getLogs&address=${address}&fromBlock=0&toBlock=latest`
    );
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.result) ? json.result : [];
  } catch {
    return [];
  }
}

/**
 * Fetches all protocol event logs and groups them into hour-buckets
 * over the last 7 days for the Activity Pulse heatmap.
 */
export function useProtocolActivity() {
  const [buckets, setBuckets] = useState<ActivityBucket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const loadActivity = useCallback(async () => {
    try {
      setIsLoading(true);
      const [vaultLogs, poolLogs, collateralLogs] = await Promise.all([
        fetchLogs(CHARIOT_ADDRESSES.CHARIOT_VAULT),
        fetchLogs(CHARIOT_ADDRESSES.LENDING_POOL),
        fetchLogs(CHARIOT_ADDRESSES.COLLATERAL_MANAGER),
      ]);

      const allLogs = [...vaultLogs, ...poolLogs, ...collateralLogs];
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      // Build a map: "YYYY-MM-DD-HH" -> count
      const map = new Map<string, number>();

      for (const log of allLogs) {
        const tsMs = parseInt(log.timeStamp, 16) * 1000;
        if (tsMs < sevenDaysAgo) continue;
        const d = new Date(tsMs);
        const date = d.toISOString().slice(0, 10);
        const hour = d.getUTCHours();
        const key = `${date}-${hour}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }

      // Expand into full 7x24 grid (fill zeros for missing buckets)
      const result: ActivityBucket[] = [];
      for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
        const d = new Date(now - dayOffset * 24 * 60 * 60 * 1000);
        const date = d.toISOString().slice(0, 10);
        for (let hour = 0; hour < 24; hour++) {
          result.push({ date, hour, count: map.get(`${date}-${hour}`) ?? 0 });
        }
      }

      setBuckets(result);
      setIsError(false);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivity();
    const id = setInterval(loadActivity, 60_000);
    return () => clearInterval(id);
  }, [loadActivity]);

  return { buckets, isLoading, isError, refetch: loadActivity };
}
