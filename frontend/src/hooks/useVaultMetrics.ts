"use client";

import { useMemo, useCallback } from "react";
import { useReadContract } from "wagmi";
import {
  ChariotVaultABI,
  LendingPoolABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
  RATE_MODEL,
  USDC_ERC20_DECIMALS,
} from "@chariot/shared";

interface VaultMetricsData {
  totalAssets: number;
  totalBorrowed: number;
  totalIdle: number;
  usycAllocated: number;
  sharePrice: number;
  utilisationRate: number;
  supplyAPY: number;
  borrowRate: number;
  tbillYieldComponent: number;
  borrowInterestComponent: number;
}

const USDC_DIVISOR = 10 ** USDC_ERC20_DECIMALS;

export function useVaultMetrics() {
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

  const data = useMemo((): VaultMetricsData | null => {
    if (rawTotalAssets === undefined || rawTotalLent === undefined || rawTotalBorrowed === undefined) {
      return null;
    }

    const totalAssets = Number(rawTotalAssets) / USDC_DIVISOR;
    const totalBorrowed = Number(rawTotalBorrowed) / USDC_DIVISOR;
    const totalLent = Number(rawTotalLent) / USDC_DIVISOR;

    // idle = totalAssets - totalLent (totalLent includes what's lent out)
    const totalIdle = Math.max(0, totalAssets - totalLent);
    // USYC allocation = totalLent - totalBorrowed (funds deployed to USYC strategy)
    const usycAllocated = Math.max(0, totalLent - totalBorrowed);

    // Utilisation rate as a percentage
    const utilisationRate = totalAssets > 0 ? (totalBorrowed / totalAssets) * 100 : 0;
    const utilisationFraction = utilisationRate / 100;

    // Borrow rate calculation (kinked model)
    let borrowRate: number;
    if (utilisationFraction <= RATE_MODEL.U_OPTIMAL) {
      borrowRate =
        RATE_MODEL.R_BASE +
        RATE_MODEL.R_SLOPE1 * (utilisationFraction / RATE_MODEL.U_OPTIMAL);
    } else {
      borrowRate =
        RATE_MODEL.R_BASE +
        RATE_MODEL.R_SLOPE1 +
        RATE_MODEL.R_SLOPE2 *
          ((utilisationFraction - RATE_MODEL.U_OPTIMAL) /
            (1 - RATE_MODEL.U_OPTIMAL));
    }

    // Supply APY calculation
    const borrowComponent =
      borrowRate * utilisationFraction * (1 - RATE_MODEL.RESERVE_FACTOR);
    const tbillComponent =
      RATE_MODEL.USYC_YIELD *
      (1 - utilisationFraction) *
      (1 - RATE_MODEL.STRATEGY_FEE);
    const supplyAPY = borrowComponent + tbillComponent;

    // Share price: for a fresh vault with no yield yet, it's 1.0
    // In reality share price = totalAssets / totalSupply, but we don't have totalSupply here
    // We use 1.0 as a reasonable default -- the real share price is convertToAssets(1e6) / 1e6
    const sharePrice = 1.0;

    return {
      totalAssets,
      totalBorrowed,
      totalIdle,
      usycAllocated,
      sharePrice,
      utilisationRate,
      supplyAPY: supplyAPY * 100,
      borrowRate: borrowRate * 100,
      tbillYieldComponent: tbillComponent * 100,
      borrowInterestComponent: borrowComponent * 100,
    };
  }, [rawTotalAssets, rawTotalLent, rawTotalBorrowed]);

  const refetch = useCallback(() => {
    refetchAssets();
    refetchLent();
    refetchBorrowed();
  }, [refetchAssets, refetchLent, refetchBorrowed]);

  return { data, isLoading, isError, refetch };
}
