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
  const res = await fetch(
    `${ARCSCAN_API}?module=logs&action=getLogs&address=${address}&fromBlock=0&toBlock=latest`
  );
  if (!res.ok) throw new Error(`ArcScan API returned ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.result) ? json.result : [];
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
      const results = await Promise.allSettled([
        fetchLogs(CHARIOT_ADDRESSES.CHARIOT_VAULT),
        fetchLogs(CHARIOT_ADDRESSES.LENDING_POOL),
        fetchLogs(CHARIOT_ADDRESSES.COLLATERAL_MANAGER),
      ]);

      // If every request failed, surface error
      const rejectedCount = results.filter((r) => r.status === "rejected").length;
      if (rejectedCount === results.length) {
        console.error(
          "[useProtocolActivity] All ArcScan API queries failed:",
          results.map((r) => (r.status === "rejected" ? r.reason : null))
        );
        setIsError(true);
        setIsLoading(false);
        return;
      }

      const extractValue = (result: PromiseSettledResult<RawLog[]>): RawLog[] =>
        result.status === "fulfilled" ? result.value : [];

      const allLogs = [
        ...extractValue(results[0]),
        ...extractValue(results[1]),
        ...extractValue(results[2]),
      ];
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
    } catch (err) {
      console.error("[useProtocolActivity] Failed to load activity:", err);
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

  const refetch = useCallback(() => { loadActivity(); }, [loadActivity]);
  return { buckets, isLoading, isError, refetch };
}
