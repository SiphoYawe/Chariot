"use client";

import { useMemo, useCallback } from "react";
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
  /** Last update timestamp (seconds) */
  lastUpdated: number;
  /** Whether the price is stale (> 1 hour) */
  isStale: boolean;
}

const WAD = BigInt(10) ** BigInt(18);

/**
 * Hook for fetching the current ETH/USD price from the CollateralManager oracle.
 * Reads collateralManager.getETHPrice() which returns the price in WAD (18 decimals).
 * Staleness is determined by comparing the data fetch time against STALENESS_THRESHOLD_SECONDS.
 */
export function useETHUSDPrice() {
  const {
    data: rawPrice,
    isLoading,
    isError,
    refetch: refetchContract,
    dataUpdatedAt,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getETHPrice",
    query: { refetchInterval: POLLING_INTERVAL_MS },
  });

  const data = useMemo((): ETHUSDPriceData | null => {
    if (rawPrice === undefined) return null;

    const price = Number(rawPrice) / Number(WAD);
    const lastUpdated = dataUpdatedAt
      ? Math.floor(dataUpdatedAt / 1000)
      : Math.floor(Date.now() / 1000);
    const now = Math.floor(Date.now() / 1000);
    const isStale = now - lastUpdated > STALENESS_THRESHOLD_SECONDS;

    return { price, lastUpdated, isStale };
  }, [rawPrice, dataUpdatedAt]);

  const refetch = useCallback(() => {
    refetchContract();
  }, [refetchContract]);

  return { data, isLoading, isError, refetch };
}
