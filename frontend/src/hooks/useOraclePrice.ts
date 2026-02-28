"use client";

import { useMemo, useCallback } from "react";
import { useReadContract } from "wagmi";
import {
  CollateralManagerABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
} from "@chariot/shared";

interface OraclePriceData {
  ethPrice: number;
  lastUpdated: number; // Unix timestamp in seconds
}

const WAD = BigInt(10) ** BigInt(18);

export function useOraclePrice() {
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

  const data = useMemo((): OraclePriceData | null => {
    if (rawPrice === undefined) return null;

    // ETH price from oracle is in WAD (18 decimals)
    const ethPrice = Number(rawPrice) / Number(WAD);
    // Use the query's data update time as an approximation of last updated
    const lastUpdated = dataUpdatedAt
      ? Math.floor(dataUpdatedAt / 1000)
      : Math.floor(Date.now() / 1000);

    return { ethPrice, lastUpdated };
  }, [rawPrice, dataUpdatedAt]);

  const refetch = useCallback(() => {
    refetchContract();
  }, [refetchContract]);

  return { data, isLoading, isError, refetch };
}
