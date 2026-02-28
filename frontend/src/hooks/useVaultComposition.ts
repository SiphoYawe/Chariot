"use client";

import { useMemo, useCallback } from "react";
import { useReadContract } from "wagmi";
import {
  ChariotVaultABI,
  LendingPoolABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
  USDC_ERC20_DECIMALS,
} from "@chariot/shared";

export interface VaultCompositionData {
  idle: number;
  lent: number;
  usyc: number;
  total: number;
}

const USDC_DIVISOR = 10 ** USDC_ERC20_DECIMALS;

/**
 * Hook for fetching vault composition.
 * Reads vault.totalAssets() and vault.totalLent() to calculate
 * idle USDC, lent amount, and USYC allocation.
 */
export function useVaultComposition() {
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

  const {
    data: rawTotalLent,
    isLoading: loadingLent,
    isError: errorLent,
    refetch: refetchLent,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "totalLent",
    query: { refetchInterval: POLLING_INTERVAL_MS },
  });

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

  const isLoading = loadingAssets || loadingLent || loadingBorrowed;
  const isError = errorAssets || errorLent || errorBorrowed;

  const data = useMemo((): VaultCompositionData | null => {
    if (
      rawTotalAssets === undefined ||
      rawTotalLent === undefined ||
      rawTotalBorrowed === undefined
    ) {
      return null;
    }

    const total = Number(rawTotalAssets) / USDC_DIVISOR;
    const totalLent = Number(rawTotalLent) / USDC_DIVISOR;
    const totalBorrowed = Number(rawTotalBorrowed) / USDC_DIVISOR;

    // idle = totalAssets - totalLent
    const idle = Math.max(0, total - totalLent);
    // lent = totalBorrowed (amount actively lent to borrowers)
    const lent = totalBorrowed;
    // usyc = totalLent - totalBorrowed (surplus deployed to USYC strategy)
    const usyc = Math.max(0, totalLent - totalBorrowed);

    return { idle, lent, usyc, total };
  }, [rawTotalAssets, rawTotalLent, rawTotalBorrowed]);

  const refetch = useCallback(() => {
    refetchAssets();
    refetchLent();
    refetchBorrowed();
  }, [refetchAssets, refetchLent, refetchBorrowed]);

  return { data, isLoading, isError, refetch };
}
