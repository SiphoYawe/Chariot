"use client";

import { useState, useEffect, useCallback } from "react";
import { POLLING_INTERVAL_MS, RATE_MODEL } from "@chariot/shared";

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

function getMockBorrowRate(): BorrowRateData {
  // Mock: ~50% utilisation, rate ~2.5%
  const utilisation = 0.5;
  const rate = RATE_MODEL.R_SLOPE1 * (utilisation / RATE_MODEL.U_OPTIMAL);

  return {
    borrowRate: rate,
    utilisation,
    breakdown: {
      baseRate: RATE_MODEL.R_BASE,
      utilisationComponent: rate,
    },
  };
}

/**
 * Hook for fetching the current borrow rate from InterestRateModel.
 *
 * When ABIs are populated, replace with:
 * - useReadContract for InterestRateModel.getBorrowRate(utilisation)
 * - useReadContract for InterestRateModel.getUtilisation(totalBorrowed, totalDeposits)
 */
export function useBorrowRate() {
  const [data, setData] = useState<BorrowRateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      setTimeout(() => {
        if (!active) return;
        try {
          setData(getMockBorrowRate());
          setIsLoading(false);
        } catch {
          setIsError(true);
          setIsLoading(false);
        }
      }, 200);
    };
    load();
    const interval = setInterval(load, POLLING_INTERVAL_MS);
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
        setData(getMockBorrowRate());
        setIsLoading(false);
      } catch {
        setIsError(true);
        setIsLoading(false);
      }
    }, 200);
  }, []);

  return { data, isLoading, isError, refetch };
}
