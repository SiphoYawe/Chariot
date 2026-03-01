"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { decodeEventLog } from "viem";
import { useVaultMetrics } from "./useVaultMetrics";
import {
  ChariotVaultABI,
  LendingPoolABI,
  CHARIOT_ADDRESSES,
  USDC_ERC20_DECIMALS,
} from "@chariot/shared";
import { type TimePeriod, PERIOD_CUTOFFS, MIN_SNAPSHOT_INTERVAL_MS } from "@/types/charts";

export type { TimePeriod };

export interface UtilisationDataPoint {
  timestamp: number;
  utilisation: number;
}

const STORAGE_KEY = "chariot_utilisation_history";
const MAX_SNAPSHOTS = 2592;
const USDC_DIVISOR = 10 ** USDC_ERC20_DECIMALS;

// ArcScan Blockscout API for event log fetching
const ARCSCAN_API = "https://testnet.arcscan.app/api";

// -- localStorage helpers --

function isValidDataPoint(v: unknown): v is UtilisationDataPoint {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as UtilisationDataPoint).timestamp === "number" &&
    typeof (v as UtilisationDataPoint).utilisation === "number"
  );
}

function loadSnapshots(): UtilisationDataPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidDataPoint);
  } catch {
    return [];
  }
}

function saveSnapshots(snapshots: UtilisationDataPoint[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = snapshots.slice(-MAX_SNAPSHOTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // silently ignore
  }
}

function filterByPeriod(data: UtilisationDataPoint[], period: TimePeriod): UtilisationDataPoint[] {
  if (period === "all") return data;
  const now = Date.now();
  const cutoff = now - PERIOD_CUTOFFS[period];
  return data.filter((d) => d.timestamp >= cutoff);
}

// -- ArcScan event log helpers --

interface BlockscoutLog {
  address: string;
  blockNumber: string;
  data: string;
  timeStamp: string;
  topics: (string | null)[];
  transactionHash: string;
}

interface DecodedEvent {
  transactionHash: string;
  blockNumber: number;
  timestamp: number; // ms
  eventName: string;
  args: Record<string, unknown>;
}

async function fetchContractLogs(contractAddress: string): Promise<BlockscoutLog[]> {
  const url = `${ARCSCAN_API}?module=logs&action=getLogs&address=${contractAddress}&fromBlock=0&toBlock=latest`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ArcScan API returned ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json.result)) return [];
  return json.result;
}

function decodeLogs(logs: BlockscoutLog[], abi: readonly unknown[]): DecodedEvent[] {
  const decoded: DecodedEvent[] = [];
  for (const log of logs) {
    try {
      const topics = log.topics.filter((t): t is string => t != null) as `0x${string}`[];
      if (topics.length === 0) continue;

      const result = decodeEventLog({
        abi,
        data: log.data as `0x${string}`,
        topics: topics as [signature: `0x${string}`, ...args: `0x${string}`[]],
      });

      decoded.push({
        transactionHash: log.transactionHash,
        blockNumber: parseInt(log.blockNumber, 16),
        timestamp: parseInt(log.timeStamp, 16) * 1000,
        eventName: result.eventName,
        args: result.args as Record<string, unknown>,
      });
    } catch {
      // Log doesn't match any event in the ABI -- skip
    }
  }
  return decoded;
}

/**
 * Reconstruct historical utilisation from on-chain events.
 *
 * Strategy: start from current on-chain state (totalBorrowed, totalAssets)
 * and walk backward through Borrowed, Repaid, Deposit, Withdraw events to
 * reconstruct the state at each past event timestamp.
 */
function reconstructFromEvents(
  vaultEvents: DecodedEvent[],
  poolEvents: DecodedEvent[],
  currentBorrowed: number,
  currentAssets: number,
): UtilisationDataPoint[] {
  // Merge and sort all events chronologically by block number then by index
  const allEvents = [...vaultEvents, ...poolEvents].sort(
    (a, b) => a.blockNumber - b.blockNumber || a.timestamp - b.timestamp,
  );

  if (allEvents.length === 0) return [];

  // Walk backward from current state to reconstruct past states
  const reversed = [...allEvents].reverse();
  let borrowed = currentBorrowed;
  let assets = currentAssets;

  // Build checkpoints in reverse order (newest to oldest)
  const checkpoints: UtilisationDataPoint[] = [];

  // Current point
  checkpoints.push({
    timestamp: Date.now(),
    utilisation: assets > 0 ? Math.max(0, Math.min(100, (borrowed / assets) * 100)) : 0,
  });

  for (const event of reversed) {
    // Reverse the event's effect to get the state BEFORE the event
    switch (event.eventName) {
      case "Borrowed":
        borrowed -= Number((event.args.amount as bigint) ?? BigInt(0)) / USDC_DIVISOR;
        break;
      case "Repaid":
        borrowed += Number((event.args.amount as bigint) ?? BigInt(0)) / USDC_DIVISOR;
        break;
      case "Deposit":
        assets -= Number((event.args.assets as bigint) ?? BigInt(0)) / USDC_DIVISOR;
        break;
      case "Withdraw":
        assets += Number((event.args.assets as bigint) ?? BigInt(0)) / USDC_DIVISOR;
        break;
      default:
        continue; // skip events that don't affect utilisation
    }

    // Clamp values to avoid negative numbers from rounding
    borrowed = Math.max(0, borrowed);
    assets = Math.max(0, assets);

    const utilisation =
      assets > 0 ? Math.max(0, Math.min(100, (borrowed / assets) * 100)) : 0;

    checkpoints.push({
      timestamp: event.timestamp,
      utilisation,
    });
  }

  // Reverse to chronological order
  checkpoints.reverse();
  return checkpoints;
}

/**
 * Deduplicate data points that are within `thresholdMs` of each other,
 * keeping the one with the later timestamp (more accurate).
 */
function deduplicateByTimestamp(
  points: UtilisationDataPoint[],
  thresholdMs: number,
): UtilisationDataPoint[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const result: UtilisationDataPoint[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = result[result.length - 1];
    if (sorted[i].timestamp - last.timestamp > thresholdMs) {
      result.push(sorted[i]);
    }
  }
  return result;
}

export function useUtilisationHistory(period: TimePeriod = "7d") {
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [eventData, setEventData] = useState<UtilisationDataPoint[]>([]);
  const snapshotsRef = useRef<UtilisationDataPoint[]>([]);
  const initializedRef = useRef(false);
  const eventsFetchedRef = useRef(false);

  const { data: metrics } = useVaultMetrics();

  // Lazy-initialize from localStorage
  if (!initializedRef.current && typeof window !== "undefined") {
    snapshotsRef.current = loadSnapshots();
    initializedRef.current = true;
  }

  // Fetch on-chain events to reconstruct historical utilisation
  useEffect(() => {
    if (!metrics || eventsFetchedRef.current) return;
    const currentBorrowed = metrics.totalBorrowed;
    const currentAssets = metrics.totalAssets;

    async function fetchEvents() {
      try {
        const [vaultResult, poolResult] = await Promise.allSettled([
          fetchContractLogs(CHARIOT_ADDRESSES.CHARIOT_VAULT),
          fetchContractLogs(CHARIOT_ADDRESSES.LENDING_POOL),
        ]);

        const vaultLogs = vaultResult.status === "fulfilled" ? vaultResult.value : [];
        const poolLogs = poolResult.status === "fulfilled" ? poolResult.value : [];

        const vaultEvents = decodeLogs(vaultLogs, ChariotVaultABI);
        const poolEvents = decodeLogs(poolLogs, LendingPoolABI);

        const checkpoints = reconstructFromEvents(
          vaultEvents,
          poolEvents,
          currentBorrowed,
          currentAssets,
        );

        if (checkpoints.length > 0) {
          setEventData(checkpoints);
        }

        eventsFetchedRef.current = true;
        setIsLoading(false);
      } catch (err) {
        console.error("[useUtilisationHistory] Event fetch failed:", err);
        eventsFetchedRef.current = true;
        setIsLoading(false);
        // Fall back to localStorage data -- don't set isError since we still have data
      }
    }

    fetchEvents();
  }, [metrics]);

  // Record live snapshots from polling
  useEffect(() => {
    if (!metrics) return;

    const snapshot: UtilisationDataPoint = {
      timestamp: Date.now(),
      utilisation: metrics.utilisationRate,
    };

    const last = snapshotsRef.current[snapshotsRef.current.length - 1];
    if (!last || snapshot.timestamp - last.timestamp > MIN_SNAPSHOT_INTERVAL_MS) {
      snapshotsRef.current = [...snapshotsRef.current, snapshot];
      saveSnapshots(snapshotsRef.current);
      setVersion((v) => v + 1);
    }
  }, [metrics]);

  // Merge event-based and live snapshot data
  const data = useMemo(() => {
    const merged = [...eventData, ...snapshotsRef.current];
    const deduped = deduplicateByTimestamp(merged, 5_000);
    return filterByPeriod(deduped, period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventData, period, version]);

  const refetch = useCallback(() => {
    setIsError(false);
    eventsFetchedRef.current = false;
    try {
      snapshotsRef.current = loadSnapshots();
      setVersion((v) => v + 1);
    } catch {
      setIsError(true);
    }
  }, []);

  return { data, isLoading, isError, refetch };
}
