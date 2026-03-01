"use client";

import { useMemo, useCallback, useRef } from "react";
import { useReadContract } from "wagmi";
import {
  CollateralManagerABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
  STALENESS_THRESHOLD_SECONDS,
} from "@chariot/shared";

interface ETHUSDPriceData {
  /** ETH price in USD */
  price: number;
  /** Unix timestamp (seconds) of when the oracle price last changed on-chain */
  lastUpdated: number;
  /** Whether the price is stale (no change for > 1 hour) */
  isStale: boolean;
}

const WAD = BigInt(10) ** BigInt(18);

/**
 * Hook for fetching the current ETH/USD price from the CollateralManager oracle.
 * Reads collateralManager.getETHPrice() which returns the price in WAD (18 decimals).
 * Staleness is determined by tracking when the on-chain price actually changes,
 * not just when the client last fetched.
 */
export function useETHUSDPrice() {
  // Track the last known price and when it changed
  const lastKnownPriceRef = useRef<bigint | null>(null);
  const lastChangedAtRef = useRef<number>(Math.floor(Date.now() / 1000));

  const {
    data: rawPrice,
    isLoading,
    isError,
    refetch: refetchContract,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getETHPrice",
    query: { refetchInterval: POLLING_INTERVAL_MS },
  });

  const data = useMemo((): ETHUSDPriceData | null => {
    if (rawPrice === undefined) return null;

    const currentPrice = rawPrice as bigint;

    // Detect actual oracle price changes rather than using client fetch time
    if (lastKnownPriceRef.current === null) {
      lastKnownPriceRef.current = currentPrice;
      lastChangedAtRef.current = Math.floor(Date.now() / 1000);
    } else if (currentPrice !== lastKnownPriceRef.current) {
      lastKnownPriceRef.current = currentPrice;
      lastChangedAtRef.current = Math.floor(Date.now() / 1000);
    }

    const price = Number(currentPrice) / Number(WAD);
    const lastUpdated = lastChangedAtRef.current;
    const now = Math.floor(Date.now() / 1000);
    const isStale = now - lastUpdated > STALENESS_THRESHOLD_SECONDS;

    return { price, lastUpdated, isStale };
  }, [rawPrice]);

  const refetch = useCallback(() => {
    refetchContract();
  }, [refetchContract]);

  return { data, isLoading, isError, refetch };
}
