"use client";

import { useMemo, useCallback, useRef } from "react";
import { useReadContract } from "wagmi";
import {
  CollateralManagerABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
} from "@chariot/shared";

interface OraclePriceData {
  ethPrice: number;
  /** Unix timestamp (seconds) of when the oracle price last changed on-chain */
  lastUpdated: number;
}

const WAD = BigInt(10) ** BigInt(18);

export function useOraclePrice() {
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

  const data = useMemo((): OraclePriceData | null => {
    if (rawPrice === undefined) return null;

    const currentPrice = rawPrice as bigint;

    // Detect actual oracle price changes rather than using client fetch time.
    // When the on-chain price changes, that's when the oracle was truly updated.
    if (lastKnownPriceRef.current === null) {
      // First read -- initialize tracking
      lastKnownPriceRef.current = currentPrice;
      lastChangedAtRef.current = Math.floor(Date.now() / 1000);
    } else if (currentPrice !== lastKnownPriceRef.current) {
      // Price changed on-chain -- oracle was updated
      lastKnownPriceRef.current = currentPrice;
      lastChangedAtRef.current = Math.floor(Date.now() / 1000);
    }

    const ethPrice = Number(currentPrice) / Number(WAD);

    return { ethPrice, lastUpdated: lastChangedAtRef.current };
  }, [rawPrice]);

  const refetch = useCallback(() => {
    refetchContract();
  }, [refetchContract]);

  return { data, isLoading, isError, refetch };
}
