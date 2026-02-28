"use client";

import { useMemo, useCallback } from "react";
import { useReadContract, useAccount } from "wagmi";
import {
  CollateralManagerABI,
  LendingPoolABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
  RISK_PARAMS,
  USDC_ERC20_DECIMALS,
} from "@chariot/shared";

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

function classifyRisk(
  hf: number,
  hasDebt: boolean
): HealthFactorData["riskLevel"] {
  if (!hasDebt) return "none";
  if (hf > 1.5) return "safe";
  if (hf >= 1.0) return "caution";
  return "danger";
}

const USDC_DIVISOR = 10 ** USDC_ERC20_DECIMALS;

/**
 * Hook for fetching a user's health factor.
 * Reads collateralManager.getCollateralValueView(user) and lendingPool.getUserDebt(user).
 * HF = (collateralValue * liquidationThreshold) / debt
 */
export function useHealthFactor(_user?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const user = _user ?? connectedAddress;

  const {
    data: rawCollateralValue,
    isLoading: loadingCollateral,
    isError: errorCollateral,
    refetch: refetchCollateral,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getCollateralValueView",
    args: [user!],
    query: {
      enabled: !!user,
      refetchInterval: POLLING_INTERVAL_MS,
    },
  });

  const {
    data: rawDebt,
    isLoading: loadingDebt,
    isError: errorDebt,
    refetch: refetchDebt,
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

  const isLoading = !user ? false : loadingCollateral || loadingDebt;
  const isError = errorCollateral || errorDebt;

  const data = useMemo((): HealthFactorData | null => {
    if (!user) return null;
    if (rawCollateralValue === undefined || rawDebt === undefined) return null;

    // Both collateralValue and debt are in USDC (6 decimals)
    const collateralValue = Number(rawCollateralValue) / USDC_DIVISOR;
    const debt = Number(rawDebt) / USDC_DIVISOR;

    const hasDebt = debt > 0;

    if (!hasDebt) {
      return {
        healthFactor: Infinity,
        isHealthy: true,
        hasDebt: false,
        riskLevel: "none",
      };
    }

    // HF = (collateralValue * liquidationThreshold) / debt
    const hf =
      (collateralValue * RISK_PARAMS.BRIDGED_ETH.LIQUIDATION_THRESHOLD) / debt;

    return {
      healthFactor: hf,
      isHealthy: hf > 1.0,
      hasDebt: true,
      riskLevel: classifyRisk(hf, true),
    };
  }, [user, rawCollateralValue, rawDebt]);

  const refetch = useCallback(() => {
    refetchCollateral();
    refetchDebt();
  }, [refetchCollateral, refetchDebt]);

  return { data, isLoading, isError, refetch };
}
