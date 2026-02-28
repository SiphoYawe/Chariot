"use client";

import { useMemo, useCallback } from "react";
import { useReadContract, useAccount } from "wagmi";
import {
  LendingPoolABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
  USDC_ERC20_DECIMALS,
} from "@chariot/shared";

interface UserDebtData {
  /** Current outstanding debt in USDC (6 decimal precision) */
  debt: number;
  /** Whether the user has active debt */
  hasDebt: boolean;
}

const USDC_DIVISOR = 10 ** USDC_ERC20_DECIMALS;

/**
 * Hook for fetching a user's current debt from LendingPool.
 * Reads lendingPool.getUserDebt(user). Returns debt in USDC (6 decimals).
 */
export function useUserDebt(_user?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const user = _user ?? connectedAddress;

  const {
    data: rawDebt,
    isLoading: loadingDebt,
    isError,
    refetch: refetchContract,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getUserDebt",
    args: [user!],
    query: {
      enabled: !!user,
      refetchInterval: POLLING_INTERVAL_MS,
    },
  });

  const isLoading = !user ? false : loadingDebt;

  const data = useMemo((): UserDebtData | null => {
    if (!user) return null;
    if (rawDebt === undefined) return null;

    const debt = Number(rawDebt) / USDC_DIVISOR;
    return {
      debt,
      hasDebt: debt > 0,
    };
  }, [user, rawDebt]);

  const refetch = useCallback(() => {
    refetchContract();
  }, [refetchContract]);

  return { data, isLoading, isError, refetch };
}
