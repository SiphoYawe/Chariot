"use client";

import { useMemo, useCallback } from "react";
import { useReadContract, useAccount } from "wagmi";
import {
  LendingPoolABI,
  CollateralManagerABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
  RISK_PARAMS,
  USDC_ERC20_DECIMALS,
} from "@chariot/shared";

export interface BorrowerPosition {
  address: string;
  collateralType: string;
  collateralAmount: number;
  collateralValueUSD: number;
  debtAmount: number;
  healthFactor: number;
}

const WAD = BigInt(10) ** BigInt(18);
const USDC_DIVISOR = 10 ** USDC_ERC20_DECIMALS;

/**
 * Hook for fetching borrower positions.
 * For MVP, shows only the connected user's position.
 * In production, this would index CollateralDeposited/Borrowed events
 * and query each borrower's position.
 */
export function useBorrowerPositions() {
  const { address } = useAccount();

  // Read user debt
  const {
    data: rawDebt,
    isLoading: loadingDebt,
    isError: errorDebt,
    refetch: refetchDebt,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getUserDebt",
    args: [address!],
    query: {
      enabled: !!address,
      refetchInterval: POLLING_INTERVAL_MS,
    },
  });

  // Read collateral balance
  const {
    data: rawCollateral,
    isLoading: loadingCollateral,
    isError: errorCollateral,
    refetch: refetchCollateral,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getCollateralBalance",
    args: [address!, CHARIOT_ADDRESSES.BRIDGED_ETH],
    query: {
      enabled: !!address,
      refetchInterval: POLLING_INTERVAL_MS,
    },
  });

  // Read ETH price
  const {
    data: rawEthPrice,
    isLoading: loadingPrice,
    isError: errorPrice,
    refetch: refetchPrice,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getETHPrice",
    query: { refetchInterval: POLLING_INTERVAL_MS },
  });

  const isLoading = !address
    ? false
    : loadingDebt || loadingCollateral || loadingPrice;
  const isError = errorDebt || errorCollateral || errorPrice;

  const positions = useMemo((): BorrowerPosition[] => {
    if (!address) return [];
    if (
      rawDebt === undefined ||
      rawCollateral === undefined ||
      rawEthPrice === undefined
    ) {
      return [];
    }

    const debt = Number(rawDebt) / USDC_DIVISOR;
    const collateralWei = rawCollateral as bigint;
    const collateralAmount = Number(collateralWei) / Number(WAD);
    const ethPrice = Number(rawEthPrice) / Number(WAD);
    const collateralValueUSD = collateralAmount * ethPrice;

    // If user has no position, return empty array
    if (debt === 0 && collateralAmount === 0) return [];

    // Health factor = (collateralValue * liquidationThreshold) / debt
    const healthFactor =
      debt > 0
        ? (collateralValueUSD *
            RISK_PARAMS.BRIDGED_ETH.LIQUIDATION_THRESHOLD) /
          debt
        : Infinity;

    return [
      {
        address,
        collateralType: "BridgedETH",
        collateralAmount,
        collateralValueUSD,
        debtAmount: debt,
        healthFactor,
      },
    ];
  }, [address, rawDebt, rawCollateral, rawEthPrice]);

  const refetch = useCallback(() => {
    refetchDebt();
    refetchCollateral();
    refetchPrice();
  }, [refetchDebt, refetchCollateral, refetchPrice]);

  return { positions, isLoading, isError, refetch };
}
