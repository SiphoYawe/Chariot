"use client";

import { useState, useEffect, useCallback } from "react";
import { POLLING_INTERVAL_MS, RISK_PARAMS } from "@chariot/shared";

interface UserPositionData {
  /** Original borrowed principal in USDC */
  principal: number;
  /** Current outstanding debt (principal + interest) in USDC */
  outstandingDebt: number;
  /** Interest accrued in USDC */
  interestAccrued: number;
  /** Collateral amount in ETH (18 decimals as number) */
  collateralAmount: number;
  /** Collateral market value in USDC */
  collateralValueUsdc: number;
  /** Effective LTV percentage (0-1) */
  effectiveLtv: number;
  /** Health factor */
  healthFactor: number;
  /** Liquidation price (ETH price at which position is liquidatable) */
  liquidationPrice: number;
  /** Max additional borrow capacity in USDC */
  maxAdditionalBorrow: number;
  /** Whether the position is active */
  isActive: boolean;
}

function getMockPosition(isActive: boolean, ethPrice: number): UserPositionData {
  if (!isActive) {
    return {
      principal: 0,
      outstandingDebt: 0,
      interestAccrued: 0,
      collateralAmount: 0,
      collateralValueUsdc: 0,
      effectiveLtv: 0,
      healthFactor: Infinity,
      liquidationPrice: 0,
      maxAdditionalBorrow: 0,
      isActive: false,
    };
  }

  const collateralEth = 5;
  const collateralValue = collateralEth * ethPrice;
  const principal = 5000;
  const outstandingDebt = 5000 + Math.random() * 0.5; // slight interest
  const interestAccrued = outstandingDebt - principal;
  const currentLtv = outstandingDebt / collateralValue;
  const maxBorrow = collateralValue * RISK_PARAMS.BRIDGED_ETH.BASE_LTV;
  const hf = (collateralValue * RISK_PARAMS.BRIDGED_ETH.LIQUIDATION_THRESHOLD) / outstandingDebt;
  const liquidationPrice = outstandingDebt / (collateralEth * RISK_PARAMS.BRIDGED_ETH.LIQUIDATION_THRESHOLD);

  return {
    principal,
    outstandingDebt,
    interestAccrued,
    collateralAmount: collateralEth,
    collateralValueUsdc: collateralValue,
    effectiveLtv: currentLtv,
    healthFactor: hf,
    liquidationPrice,
    maxAdditionalBorrow: Math.max(0, maxBorrow - outstandingDebt),
    isActive: true,
  };
}

/**
 * Hook for fetching a user's full borrower position.
 * Combines data from LendingPool, CollateralManager, and Stork oracle.
 *
 * When ABIs are populated, replace with:
 * - useReadContract for LendingPool.getUserPosition
 * - useReadContract for LendingPool.getUserDebt
 * - useReadContract for CollateralManager.getCollateralBalance
 * - Stork oracle price for calculations
 */
export function useUserPosition(_user?: `0x${string}`, _ethPrice?: number) {
  const [data, setData] = useState<UserPositionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const ethPrice = _ethPrice ?? 2450;

  useEffect(() => {
    let active = true;
    const load = () => {
      setTimeout(() => {
        if (!active) return;
        try {
          setData(getMockPosition(false, ethPrice));
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
  }, [_user, ethPrice]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    setIsError(false);
    setTimeout(() => {
      try {
        setData(getMockPosition(false, ethPrice));
        setIsLoading(false);
      } catch {
        setIsError(true);
        setIsLoading(false);
      }
    }, 300);
  }, [ethPrice]);

  return { data, isLoading, isError, refetch };
}
