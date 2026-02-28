"use client";

import { useMemo, useCallback } from "react";
import { useReadContract } from "wagmi";
import {
  ChariotVaultABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
} from "@chariot/shared";
import type { CircuitBreakerLevel } from "@chariot/shared";

const LEVEL_LABELS: Record<number, string> = {
  0: "Normal",
  1: "Caution",
  2: "Restricted",
  3: "Halted",
};

export function useCircuitBreakerStatus() {
  const {
    data: rawLevel,
    isLoading,
    isError,
    refetch: refetchContract,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "circuitBreakerLevel",
    query: { refetchInterval: POLLING_INTERVAL_MS },
  });

  const level: CircuitBreakerLevel = useMemo(() => {
    if (rawLevel === undefined) return 0;
    const num = Number(rawLevel);
    if (num >= 0 && num <= 3) return num as CircuitBreakerLevel;
    return 0;
  }, [rawLevel]);

  const statusLabel = LEVEL_LABELS[level] ?? "Unknown";

  const refetch = useCallback(() => {
    refetchContract();
  }, [refetchContract]);

  return { level, statusLabel, isLoading, isError, refetch };
}
