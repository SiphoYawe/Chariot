"use client";

import { useState, useEffect, useCallback } from "react";
import { POLLING_INTERVAL_MS, RATE_MODEL } from "@chariot/shared";

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

function getMockRateBreakdown(utilisation: number): RateBreakdownData {
  // Calculate base rate from kinked model
  let baseRate: number;
  if (utilisation <= RATE_MODEL.U_OPTIMAL) {
    baseRate = RATE_MODEL.R_BASE + RATE_MODEL.R_SLOPE1 * (utilisation / RATE_MODEL.U_OPTIMAL);
  } else {
    baseRate =
      RATE_MODEL.R_BASE +
      RATE_MODEL.R_SLOPE1 +
      RATE_MODEL.R_SLOPE2 *
        ((utilisation - RATE_MODEL.U_OPTIMAL) / (1 - RATE_MODEL.U_OPTIMAL));
  }

  // Mock: simulate volatility premium of 5% (vol = 35%, kVol = 0.5, excess = 10%)
  const volatilityPremium = 0.05;
  const totalRate = baseRate + volatilityPremium;

  return {
    baseRate,
    volatilityPremium,
    totalRate,
    isPremiumActive: volatilityPremium > 0,
  };
}

/**
 * Hook for fetching rate breakdown from InterestRateModel.
 *
 * When ABIs are populated, replace with:
 * - useReadContract for InterestRateModel.getRateBreakdown(utilisation, collateralToken)
 * Poll every 12 seconds (1 Arc block).
 */
export function useRateBreakdown(utilisation: number = 0.5, _collateralToken?: `0x${string}`) {
  const [data, setData] = useState<RateBreakdownData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      setTimeout(() => {
        if (!active) return;
        try {
          setData(getMockRateBreakdown(utilisation));
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
  }, [utilisation, _collateralToken]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    setIsError(false);
    setTimeout(() => {
      try {
        setData(getMockRateBreakdown(utilisation));
        setIsLoading(false);
      } catch {
        setIsError(true);
        setIsLoading(false);
      }
    }, 200);
  }, [utilisation]);

  return { data, isLoading, isError, refetch };
}
