"use client";

import { useState, useEffect, useCallback } from "react";
import { RATE_MODEL } from "@chariot/shared";

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

// Mock data until contracts are deployed
function getMockData(): VaultMetricsData {
  const totalAssets = 1_000_000;
  const totalBorrowed = 450_000;
  const usycAllocated = 350_000;
  const totalIdle = totalAssets - totalBorrowed - usycAllocated;
  const utilisationRate = (totalBorrowed / totalAssets) * 100;
  const utilisationFraction = utilisationRate / 100;

  // Borrow rate calculation (kinked model)
  let borrowRate: number;
  if (utilisationFraction <= RATE_MODEL.U_OPTIMAL) {
    borrowRate = RATE_MODEL.R_BASE + RATE_MODEL.R_SLOPE1 * (utilisationFraction / RATE_MODEL.U_OPTIMAL);
  } else {
    borrowRate = RATE_MODEL.R_BASE + RATE_MODEL.R_SLOPE1 + RATE_MODEL.R_SLOPE2 * ((utilisationFraction - RATE_MODEL.U_OPTIMAL) / (1 - RATE_MODEL.U_OPTIMAL));
  }

  // Supply APY calculation
  const borrowComponent = borrowRate * utilisationFraction * (1 - RATE_MODEL.RESERVE_FACTOR);
  const tbillComponent = RATE_MODEL.USYC_YIELD * (1 - utilisationFraction) * (1 - RATE_MODEL.STRATEGY_FEE);
  const supplyAPY = borrowComponent + tbillComponent;

  return {
    totalAssets,
    totalBorrowed,
    totalIdle,
    usycAllocated,
    sharePrice: 1.000000,
    utilisationRate,
    supplyAPY: supplyAPY * 100,
    borrowRate: borrowRate * 100,
    tbillYieldComponent: tbillComponent * 100,
    borrowInterestComponent: borrowComponent * 100,
  };
}

export function useVaultMetrics() {
  const [data, setData] = useState<VaultMetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      setTimeout(() => {
        if (!active) return;
        try {
          setData(getMockData());
          setIsLoading(false);
        } catch {
          setIsError(true);
          setIsLoading(false);
        }
      }, 500);
    };
    load();
    const interval = setInterval(load, 12_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const refetch = useCallback(() => {
    setIsLoading(true);
    setIsError(false);
    setTimeout(() => {
      try {
        setData(getMockData());
        setIsLoading(false);
      } catch {
        setIsError(true);
        setIsLoading(false);
      }
    }, 500);
  }, []);

  return { data, isLoading, isError, refetch };
}
