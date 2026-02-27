"use client";

import { useState, useEffect, useCallback } from "react";
import { POLLING_INTERVAL_MS, RISK_PARAMS } from "@chariot/shared";

interface CollateralData {
  /** BridgedETH balance in CollateralManager (wei) */
  collateralBalance: bigint;
  /** Collateral value in USDC terms (6 decimals) */
  collateralValueUsdc: number;
  /** BridgedETH balance in user wallet on Arc (wei) */
  walletBalance: bigint;
  /** Effective LTV percentage */
  effectiveLtv: number;
  /** Whether user has any collateral deposited */
  hasCollateral: boolean;
}

function getMockCollateralData(hasDeposit: boolean): CollateralData {
  if (!hasDeposit) {
    return {
      collateralBalance: BigInt(0),
      collateralValueUsdc: 0,
      walletBalance: BigInt(0),
      effectiveLtv: RISK_PARAMS.BRIDGED_ETH.BASE_LTV,
      hasCollateral: false,
    };
  }
  // Mock: 5 ETH deposited at ~$2450
  return {
    collateralBalance: BigInt("5000000000000000000"), // 5 ETH
    collateralValueUsdc: 12250, // 5 * $2450
    walletBalance: BigInt(0),
    effectiveLtv: RISK_PARAMS.BRIDGED_ETH.BASE_LTV,
    hasCollateral: true,
  };
}

/**
 * Hook for fetching a user's collateral data from CollateralManager.
 * Uses mock data until contracts are deployed.
 *
 * When ABIs are populated, replace with:
 * - useReadContract for CollateralManager.getCollateralBalance
 * - useReadContract for BridgedETH.balanceOf (wallet balance)
 * - useReadContract for CollateralManager.getCollateralValue
 */
export function useCollateralData(_user?: `0x${string}`) {
  const [data, setData] = useState<CollateralData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      setTimeout(() => {
        if (!active) return;
        try {
          // Mock: simulate no collateral for new users
          setData(getMockCollateralData(false));
          setIsLoading(false);
        } catch {
          setIsError(true);
          setIsLoading(false);
        }
      }, 300);
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
        setData(getMockCollateralData(false));
        setIsLoading(false);
      } catch {
        setIsError(true);
        setIsLoading(false);
      }
    }, 300);
  }, []);

  return { data, isLoading, isError, refetch };
}
