"use client";

import { useMemo, useCallback } from "react";
import { useReadContract } from "wagmi";
import {
  ChariotVaultABI,
  LendingPoolABI,
  InterestRateModelABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
} from "@chariot/shared";

interface RateBreakdownData {
  /** Base utilisation rate (0-1) */
  baseRate: number;
  /** Volatility premium (0-1) */
  volatilityPremium: number;
  /** Total borrow rate (0-1) */
  totalRate: number;
  /** Whether volatility premium is active */
  isPremiumActive: boolean;
}

const WAD = BigInt(10) ** BigInt(18);

/**
 * Hook for fetching rate breakdown from InterestRateModel.
 * First computes utilisation from vault.totalAssets() and lendingPool.getTotalBorrowed(),
 * then calls interestRateModel.getRateBreakdown(utilisation, BRIDGED_ETH).
 */
export function useRateBreakdown() {
  // Read totalAssets to compute utilisation
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

  // Read totalBorrowed to compute utilisation
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

  // Compute utilisation in WAD for on-chain call
  const utilisationWad = useMemo(() => {
    if (rawTotalAssets === undefined || rawTotalBorrowed === undefined)
      return undefined;
    const totalAssets = rawTotalAssets as bigint;
    if (totalAssets === BigInt(0)) return BigInt(0);
    return ((rawTotalBorrowed as bigint) * WAD) / totalAssets;
  }, [rawTotalAssets, rawTotalBorrowed]);

  // Call getRateBreakdown(utilisation, BRIDGED_ETH) on-chain
  const {
    data: rawBreakdown,
    isLoading: loadingBreakdown,
    isError: errorBreakdown,
    refetch: refetchBreakdown,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.INTEREST_RATE_MODEL,
    abi: InterestRateModelABI,
    functionName: "getRateBreakdown",
    args: [utilisationWad!, CHARIOT_ADDRESSES.BRIDGED_ETH],
    query: {
      enabled: utilisationWad !== undefined,
      refetchInterval: POLLING_INTERVAL_MS,
    },
  });

  const isLoading = loadingAssets || loadingBorrowed || loadingBreakdown;
  const isError = errorAssets || errorBorrowed || errorBreakdown;

  const data = useMemo((): RateBreakdownData | null => {
    if (rawBreakdown === undefined) return null;

    // getRateBreakdown returns (baseRate, volatilityPremium, totalRate) all in WAD
    const breakdown = rawBreakdown as readonly [bigint, bigint, bigint];
    const baseRate = Number(breakdown[0]) / Number(WAD);
    const volatilityPremium = Number(breakdown[1]) / Number(WAD);
    const totalRate = Number(breakdown[2]) / Number(WAD);

    return {
      baseRate,
      volatilityPremium,
      totalRate,
      isPremiumActive: volatilityPremium > 0,
    };
  }, [rawBreakdown]);

  const refetch = useCallback(() => {
    refetchAssets();
    refetchBorrowed();
    refetchBreakdown();
  }, [refetchAssets, refetchBorrowed, refetchBreakdown]);

  return { data, isLoading, isError, refetch };
}
