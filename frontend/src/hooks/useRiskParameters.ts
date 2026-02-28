"use client";

import { useState, useEffect, useCallback } from "react";
import { POLLING_INTERVAL_MS, RISK_PARAMS } from "@chariot/shared";

interface RiskParametersData {
  /** Dynamic effective LTV (0-1, e.g., 0.70 = 70%) */
  effectiveLTV: number;
  /** Dynamic liquidation threshold (0-1) */
  liquidationThreshold: number;
  /** Current annualized volatility (0-1, e.g., 0.35 = 35%) */
  currentVolatility: number;
  /** Base LTV before adjustment (0-1) */
  baseLTV: number;
  /** Whether RiskParameterEngine is available */
  isEngineAvailable: boolean;
}

function getMockRiskParameters(): RiskParametersData {
  // Mock: simulate moderately elevated volatility (35%)
  const currentVolatility = 0.35;
  const baseLTV = RISK_PARAMS.BRIDGED_ETH.BASE_LTV;
  const baselineVol = 0.25;
  const kLtv = 0.5;
  const minFloor = 0.30;

  const excess = Math.max(0, currentVolatility - baselineVol);
  const adjustment = kLtv * excess;
  const effectiveLTV = Math.max(minFloor, baseLTV - adjustment);
  const liquidationThreshold = effectiveLTV + 0.07;

  return {
    effectiveLTV,
    liquidationThreshold,
    currentVolatility,
    baseLTV,
    isEngineAvailable: true,
  };
}

/**
 * Hook for fetching dynamic risk parameters from RiskParameterEngine.
 *
 * When ABIs are populated, replace with:
 * - useReadContract for RiskParameterEngine.getRiskParameters(collateralToken)
 * - useReadContract for RiskParameterEngine.getBaseLTV(collateralToken)
 * Poll every 12 seconds (1 Arc block).
 */
export function useRiskParameters(_collateralToken?: `0x${string}`) {
  const [data, setData] = useState<RiskParametersData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      setTimeout(() => {
        if (!active) return;
        try {
          setData(getMockRiskParameters());
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
  }, [_collateralToken]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    setIsError(false);
    setTimeout(() => {
      try {
        setData(getMockRiskParameters());
        setIsLoading(false);
      } catch {
        setIsError(true);
        setIsLoading(false);
      }
    }, 200);
  }, []);

  return { data, isLoading, isError, refetch };
}
