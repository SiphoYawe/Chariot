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
  DEMO_BORROWER_ADDRESS,
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
 * Shows the connected user's position, falling back to the demo
 * borrower position when the connected wallet has no active position.
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

  // Read demo borrower debt (fallback)
  const {
    data: rawDemoDebt,
    isLoading: loadingDemoDebt,
    refetch: refetchDemoDebt,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getUserDebt",
    args: [DEMO_BORROWER_ADDRESS],
    query: { refetchInterval: POLLING_INTERVAL_MS },
  });

  // Read demo borrower collateral (fallback)
  const {
    data: rawDemoCollateral,
    isLoading: loadingDemoCollateral,
    refetch: refetchDemoCollateral,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getCollateralBalance",
    args: [DEMO_BORROWER_ADDRESS, CHARIOT_ADDRESSES.BRIDGED_ETH],
    query: { refetchInterval: POLLING_INTERVAL_MS },
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

  const isLoading = loadingPrice || loadingDemoDebt || loadingDemoCollateral ||
    (!address ? false : loadingDebt || loadingCollateral);
  const isError = errorDebt || errorCollateral || errorPrice;

  const positions = useMemo((): BorrowerPosition[] => {
    if (rawEthPrice === undefined) return [];

    const ethPrice = Number(rawEthPrice) / Number(WAD);

    function buildPosition(
      addr: string,
      debt: bigint,
      collateral: bigint,
    ): BorrowerPosition | null {
      const debtNum = Number(debt) / USDC_DIVISOR;
      const collateralAmount = Number(collateral) / Number(WAD);
      const collateralValueUSD = collateralAmount * ethPrice;

      if (debtNum === 0 && collateralAmount === 0) return null;

      const healthFactor =
        debtNum > 0
          ? (collateralValueUSD *
              RISK_PARAMS.BRIDGED_ETH.LIQUIDATION_THRESHOLD) /
            debtNum
          : Infinity;

      return {
        address: addr,
        collateralType: "BridgedETH",
        collateralAmount,
        collateralValueUSD,
        debtAmount: debtNum,
        healthFactor,
      };
    }

    // Try connected user first
    if (address && rawDebt !== undefined && rawCollateral !== undefined) {
      const pos = buildPosition(
        address,
        rawDebt as bigint,
        rawCollateral as bigint,
      );
      if (pos) return [pos];
    }

    // Fall back to demo borrower
    if (rawDemoDebt !== undefined && rawDemoCollateral !== undefined) {
      const pos = buildPosition(
        DEMO_BORROWER_ADDRESS,
        rawDemoDebt as bigint,
        rawDemoCollateral as bigint,
      );
      if (pos) return [pos];
    }

    return [];
  }, [address, rawDebt, rawCollateral, rawDemoDebt, rawDemoCollateral, rawEthPrice]);

  const refetch = useCallback(() => {
    refetchDebt();
    refetchCollateral();
    refetchDemoDebt();
    refetchDemoCollateral();
    refetchPrice();
  }, [refetchDebt, refetchCollateral, refetchDemoDebt, refetchDemoCollateral, refetchPrice]);

  return { positions, isLoading, isError, refetch };
}
