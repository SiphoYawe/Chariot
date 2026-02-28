"use client";

import { useMemo, useCallback } from "react";
import { useReadContract, useAccount } from "wagmi";
import {
  CollateralManagerABI,
  BridgedETHABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
  RISK_PARAMS,
} from "@chariot/shared";

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

const WAD = BigInt(10) ** BigInt(18);

/**
 * Hook for fetching a user's collateral data from CollateralManager.
 * Reads collateralManager.getCollateralBalance(user, BRIDGED_ETH), getETHPrice(),
 * and BridgedETH.balanceOf(user) for the wallet balance.
 */
export function useCollateralData(_user?: `0x${string}`) {
  const { address: connectedAddress } = useAccount();
  const user = _user ?? connectedAddress;

  const {
    data: rawCollateralBalance,
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

  const {
    data: rawWalletBalance,
    isLoading: loadingWallet,
    isError: errorWallet,
    refetch: refetchWallet,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.BRIDGED_ETH,
    abi: BridgedETHABI,
    functionName: "balanceOf",
    args: [user!],
    query: {
      enabled: !!user,
      refetchInterval: POLLING_INTERVAL_MS,
    },
  });

  const isLoading = !user
    ? false
    : loadingCollateral || loadingPrice || loadingWallet;
  const isError = errorCollateral || errorPrice || errorWallet;

  const data = useMemo((): CollateralData | null => {
    if (!user) return null;
    if (
      rawCollateralBalance === undefined ||
      rawEthPrice === undefined ||
      rawWalletBalance === undefined
    ) {
      return null;
    }

    const collateralBalance = rawCollateralBalance as bigint;
    const walletBalance = rawWalletBalance as bigint;
    const ethPrice = Number(rawEthPrice) / Number(WAD);

    // collateralBalance is in wei (18 decimals), convert to ETH then to USD
    const collateralEth = Number(collateralBalance) / Number(WAD);
    const collateralValueUsdc = collateralEth * ethPrice;
    const hasCollateral = collateralBalance > BigInt(0);

    return {
      collateralBalance,
      collateralValueUsdc,
      walletBalance,
      effectiveLtv: RISK_PARAMS.BRIDGED_ETH.BASE_LTV,
      hasCollateral,
    };
  }, [user, rawCollateralBalance, rawEthPrice, rawWalletBalance]);

  const refetch = useCallback(() => {
    refetchCollateral();
    refetchPrice();
    refetchWallet();
  }, [refetchCollateral, refetchPrice, refetchWallet]);

  return { data, isLoading, isError, refetch };
}
