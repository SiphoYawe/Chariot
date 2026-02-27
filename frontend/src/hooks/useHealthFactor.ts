"use client";

import { useState, useEffect, useCallback } from "react";
import { POLLING_INTERVAL_MS } from "@chariot/shared";

interface HealthFactorData {
  /** Health factor value (1.0 = liquidation threshold) */
  healthFactor: number;
  /** Whether the position is healthy (HF > 1.0) */
  isHealthy: boolean;
  /** Whether the user has an active borrow */
  hasDebt: boolean;
  /** Risk level based on HF */
  riskLevel: "safe" | "caution" | "danger" | "none";
}

function classifyRisk(hf: number, hasDebt: boolean): HealthFactorData["riskLevel"] {
  if (!hasDebt) return "none";
  if (hf > 1.5) return "safe";
  if (hf >= 1.0) return "caution";
  return "danger";
}

function getMockHealthFactor(hasDebt: boolean): HealthFactorData {
  if (!hasDebt) {
    return {
      healthFactor: Infinity,
      isHealthy: true,
      hasDebt: false,
      riskLevel: "none",
    };
  }
  const hf = 1.82;
  return {
    healthFactor: hf,
    isHealthy: hf > 1.0,
    hasDebt: true,
    riskLevel: classifyRisk(hf, true),
  };
}

/**
 * Hook for fetching a user's health factor from CollateralManager.
 * Uses mock data until contracts are deployed.
 *
 * When ABIs are populated, replace with:
 * - useReadContract for CollateralManager.getHealthFactor
 */
export function useHealthFactor(_user?: `0x${string}`) {
  const [data, setData] = useState<HealthFactorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      setTimeout(() => {
        if (!active) return;
        try {
          setData(getMockHealthFactor(false));
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
  }, [_user]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    setIsError(false);
    setTimeout(() => {
      try {
        setData(getMockHealthFactor(false));
        setIsLoading(false);
      } catch {
        setIsError(true);
        setIsLoading(false);
      }
    }, 200);
  }, []);

  return { data, isLoading, isError, refetch };
}
