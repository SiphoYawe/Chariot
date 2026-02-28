"use client";

import { useMemo, useCallback } from "react";
import { useReadContract } from "wagmi";
import {
  ChariotVaultABI,
  LendingPoolABI,
  InterestRateModelABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
  RATE_MODEL,
  USDC_ERC20_DECIMALS,
} from "@chariot/shared";

interface BorrowRateData {
  /** Current annualized borrow rate (0-1, e.g. 0.035 = 3.5%) */
  borrowRate: number;
  /** Current pool utilisation (0-1) */
  utilisation: number;
  /** Rate breakdown components */
  breakdown: {
    baseRate: number;
    utilisationComponent: number;
  };
}

const USDC_DIVISOR = 10 ** USDC_ERC20_DECIMALS;
const WAD = BigInt(10) ** BigInt(18);

/**
 * Hook for fetching the current borrow rate.
 * Reads vault.totalAssets() and lendingPool.getTotalBorrowed() to compute utilisation,
 * then calls interestRateModel.getBorrowRate(utilisation) on-chain.
 */
export function useBorrowRate() {
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
    // utilisation = (totalBorrowed * 1e18) / totalAssets
    return ((rawTotalBorrowed as bigint) * WAD) / totalAssets;
  }, [rawTotalAssets, rawTotalBorrowed]);

  // Call on-chain getBorrowRate with the computed utilisation
  const {
    data: rawBorrowRate,
    isLoading: loadingRate,
    isError: errorRate,
    refetch: refetchRate,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.INTEREST_RATE_MODEL,
    abi: InterestRateModelABI,
    functionName: "getBorrowRate",
    args: [utilisationWad!],
    query: {
      enabled: utilisationWad !== undefined,
      refetchInterval: POLLING_INTERVAL_MS,
    },
  });

  const isLoading = loadingAssets || loadingBorrowed || loadingRate;
  const isError = errorAssets || errorBorrowed || errorRate;

  const data = useMemo((): BorrowRateData | null => {
    if (
      rawTotalAssets === undefined ||
      rawTotalBorrowed === undefined
    ) {
      return null;
    }

    const totalAssets = Number(rawTotalAssets) / USDC_DIVISOR;
    const totalBorrowed = Number(rawTotalBorrowed) / USDC_DIVISOR;
    const utilisation = totalAssets > 0 ? totalBorrowed / totalAssets : 0;

    // If we got the on-chain rate, use it; otherwise compute client-side
    let borrowRate: number;
    if (rawBorrowRate !== undefined) {
      // On-chain rate is in WAD (1e18 = 100%)
      borrowRate = Number(rawBorrowRate) / Number(WAD);
    } else {
      // Client-side fallback using kinked model
      if (utilisation <= RATE_MODEL.U_OPTIMAL) {
        borrowRate =
          RATE_MODEL.R_BASE +
          RATE_MODEL.R_SLOPE1 * (utilisation / RATE_MODEL.U_OPTIMAL);
      } else {
        borrowRate =
          RATE_MODEL.R_BASE +
          RATE_MODEL.R_SLOPE1 +
          RATE_MODEL.R_SLOPE2 *
            ((utilisation - RATE_MODEL.U_OPTIMAL) /
              (1 - RATE_MODEL.U_OPTIMAL));
      }
    }

    return {
      borrowRate,
      utilisation,
      breakdown: {
        baseRate: RATE_MODEL.R_BASE,
        utilisationComponent: borrowRate - RATE_MODEL.R_BASE,
      },
    };
  }, [rawTotalAssets, rawTotalBorrowed, rawBorrowRate]);

  const refetch = useCallback(() => {
    refetchAssets();
    refetchBorrowed();
    refetchRate();
  }, [refetchAssets, refetchBorrowed, refetchRate]);

  return { data, isLoading, isError, refetch };
}
