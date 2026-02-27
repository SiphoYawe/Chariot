"use client";

import { useState, useEffect, useCallback } from "react";
import { POLLING_INTERVAL_MS } from "@chariot/shared";

interface UserDebtData {
  /** Current outstanding debt in USDC (6 decimal precision) */
  debt: number;
  /** Whether the user has active debt */
  hasDebt: boolean;
}

function getMockUserDebt(hasDebt: boolean): UserDebtData {
  if (!hasDebt) {
    return { debt: 0, hasDebt: false };
  }
  // Mock: ~5000 USDC with slight interest accrual
  return {
    debt: 5000 + Math.random() * 0.5,
    hasDebt: true,
  };
}

/**
 * Hook for fetching a user's current debt from LendingPool.
 * Polls every 12s to show live-updating interest accrual.
 *
 * When ABIs are populated, replace with:
 * - useReadContract for LendingPool.getUserDebt(user)
 */
export function useUserDebt(_user?: `0x${string}`) {
  const [data, setData] = useState<UserDebtData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      setTimeout(() => {
        if (!active) return;
        try {
          setData(getMockUserDebt(false));
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
        setData(getMockUserDebt(false));
        setIsLoading(false);
      } catch {
        setIsError(true);
        setIsLoading(false);
      }
    }, 200);
  }, []);

  return { data, isLoading, isError, refetch };
}
