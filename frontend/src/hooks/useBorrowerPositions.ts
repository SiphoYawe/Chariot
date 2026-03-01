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
 * Only queries and returns the connected wallet's position.
 * Returns empty array when no wallet is connected or no active position exists.
 */
export function useBorrowerPositions() {
  const { address } = useAccount();

  // Read connected user debt
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

  // Read connected user collateral
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

  const isLoading = loadingPrice ||
    (!address ? false : loadingDebt || loadingCollateral);
  const isError = errorDebt || errorCollateral || errorPrice;

  const positions = useMemo((): BorrowerPosition[] => {
    if (!address || rawEthPrice === undefined) return [];

    const ethPrice = Number(rawEthPrice) / Number(WAD);

    if (rawDebt === undefined || rawCollateral === undefined) return [];

    const debtNum = Number(rawDebt as bigint) / USDC_DIVISOR;
    const collateralAmount = Number(rawCollateral as bigint) / Number(WAD);
    const collateralValueUSD = collateralAmount * ethPrice;

    if (debtNum === 0 && collateralAmount === 0) return [];

    const healthFactor =
      debtNum > 0
        ? (collateralValueUSD *
            RISK_PARAMS.BRIDGED_ETH.LIQUIDATION_THRESHOLD) /
          debtNum
        : Infinity;

    return [{
      address,
      collateralType: "BridgedETH",
      collateralAmount,
      collateralValueUSD,
      debtAmount: debtNum,
      healthFactor,
    }];
  }, [address, rawDebt, rawCollateral, rawEthPrice]);

  const refetch = useCallback(() => {
    refetchDebt();
    refetchCollateral();
    refetchPrice();
  }, [refetchDebt, refetchCollateral, refetchPrice]);

  return { positions, isLoading, isError, refetch };
}
