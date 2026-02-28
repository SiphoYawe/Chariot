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

const WAD = BigInt(10) ** BigInt(18);
const USDC_DIVISOR = 10 ** USDC_ERC20_DECIMALS;

/**
 * Hook for fetching a user's full borrower position.
 * Combines data from LendingPool (getUserPosition, getUserDebt),
 * CollateralManager (getCollateralBalance, getETHPrice).
 */
export function useUserPosition(_user?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const user = _user ?? connectedAddress;

  // Read user position (principal, interestIndex, lastAccrualTimestamp)
  const {
    data: rawPosition,
    isLoading: loadingPosition,
    isError: errorPosition,
    refetch: refetchPosition,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getUserPosition",
    args: [user!],
    query: {
      enabled: !!user,
      refetchInterval: POLLING_INTERVAL_MS,
    },
  });

  // Read current debt (with accrued interest)
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

  // Read collateral balance (in wei)
  const {
    data: rawCollateral,
    isLoading: loadingCollateral,
    isError: errorCollateral,
    refetch: refetchCollateral,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getCollateralBalance",
    args: [user!, CHARIOT_ADDRESSES.BRIDGED_ETH],
    query: {
      enabled: !!user,
      refetchInterval: POLLING_INTERVAL_MS,
    },
  });

  // Read ETH price (WAD)
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

  const isLoading = !user
    ? false
    : loadingPosition || loadingDebt || loadingCollateral || loadingPrice;
  const isError = errorPosition || errorDebt || errorCollateral || errorPrice;

  const data = useMemo((): UserPositionData | null => {
    if (!user) return null;
    if (
      rawPosition === undefined ||
      rawDebt === undefined ||
      rawCollateral === undefined ||
      rawEthPrice === undefined
    ) {
      return null;
    }

    // Parse position struct: { principal, interestIndex, lastAccrualTimestamp }
    const position = rawPosition as {
      principal: bigint;
      interestIndex: bigint;
      lastAccrualTimestamp: bigint;
    };

    const principal = Number(position.principal) / USDC_DIVISOR;
    const outstandingDebt = Number(rawDebt) / USDC_DIVISOR;
    const interestAccrued = Math.max(0, outstandingDebt - principal);

    // Collateral in ETH
    const collateralWei = rawCollateral as bigint;
    const collateralAmount = Number(collateralWei) / Number(WAD);

    // ETH price in USD
    const ethPrice = Number(rawEthPrice) / Number(WAD);
    const collateralValueUsdc = collateralAmount * ethPrice;

    const isActive = outstandingDebt > 0 || collateralAmount > 0;

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

    // Effective LTV = debt / collateralValue
    const effectiveLtv =
      collateralValueUsdc > 0 ? outstandingDebt / collateralValueUsdc : 0;

    // Health factor = (collateralValue * liquidationThreshold) / debt
    const healthFactor =
      outstandingDebt > 0
        ? (collateralValueUsdc *
            RISK_PARAMS.BRIDGED_ETH.LIQUIDATION_THRESHOLD) /
          outstandingDebt
        : Infinity;

    // Liquidation price = debt / (collateralAmount * liquidationThreshold)
    const liquidationPrice =
      collateralAmount > 0
        ? outstandingDebt /
          (collateralAmount * RISK_PARAMS.BRIDGED_ETH.LIQUIDATION_THRESHOLD)
        : 0;

    // Max additional borrow = (collateralValue * baseLTV) - outstandingDebt
    const maxBorrow =
      collateralValueUsdc * RISK_PARAMS.BRIDGED_ETH.BASE_LTV;
    const maxAdditionalBorrow = Math.max(0, maxBorrow - outstandingDebt);

    return {
      principal,
      outstandingDebt,
      interestAccrued,
      collateralAmount,
      collateralValueUsdc,
      effectiveLtv,
      healthFactor,
      liquidationPrice,
      maxAdditionalBorrow,
      isActive,
    };
  }, [user, rawPosition, rawDebt, rawCollateral, rawEthPrice]);

  const refetch = useCallback(() => {
    refetchPosition();
    refetchDebt();
    refetchCollateral();
    refetchPrice();
  }, [refetchPosition, refetchDebt, refetchCollateral, refetchPrice]);

  return { data, isLoading, isError, refetch };
}
