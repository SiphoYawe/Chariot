"use client";

import { useMemo, useCallback } from "react";
import { useReadContract } from "wagmi";
import {
  ChariotVaultABI,
  LendingPoolABI,
  CollateralManagerABI,
  BridgedETHABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
  USDC_ERC20_DECIMALS,
} from "@chariot/shared";

interface ProtocolHealthData {
  tvl: number;
  totalCollateral: number;
  totalDebt: number;
  protocolReserves: number;
}

const USDC_DIVISOR = 10 ** USDC_ERC20_DECIMALS;
const WAD = BigInt(10) ** BigInt(18);

export function useProtocolHealth() {
  const {
    data: rawTotalAssets,
    isLoading: loadingAssets,
    isError: errorAssets,
    refetch: refetchAssets,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "totalAssets",
    query: { refetchInterval: POLLING_INTERVAL_MS },
  });

  const {
    data: rawTotalBorrowed,
    isLoading: loadingBorrowed,
    isError: errorBorrowed,
    refetch: refetchBorrowed,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getTotalBorrowed",
    query: { refetchInterval: POLLING_INTERVAL_MS },
  });

  const {
    data: rawTotalReserves,
    isLoading: loadingReserves,
    isError: errorReserves,
    refetch: refetchReserves,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getTotalReserves",
    query: { refetchInterval: POLLING_INTERVAL_MS },
  });

  // Read total BridgedETH held by CollateralManager (all deposited collateral)
  const {
    data: rawCollateralEth,
    isLoading: loadingCollateralEth,
    isError: errorCollateralEth,
    refetch: refetchCollateralEth,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.BRIDGED_ETH,
    abi: BridgedETHABI,
    functionName: "balanceOf",
    args: [CHARIOT_ADDRESSES.COLLATERAL_MANAGER],
    query: { refetchInterval: POLLING_INTERVAL_MS },
  });

  // Read current ETH price for collateral valuation
  const {
    data: rawEthPrice,
    isLoading: loadingEthPrice,
    isError: errorEthPrice,
    refetch: refetchEthPrice,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getETHPrice",
    query: { refetchInterval: POLLING_INTERVAL_MS },
  });

  const isLoading =
    loadingAssets ||
    loadingBorrowed ||
    loadingReserves ||
    loadingCollateralEth ||
    loadingEthPrice;
  const isError =
    errorAssets ||
    errorBorrowed ||
    errorReserves ||
    errorCollateralEth ||
    errorEthPrice;

  const data = useMemo((): ProtocolHealthData | null => {
    if (
      rawTotalAssets === undefined ||
      rawTotalBorrowed === undefined ||
      rawTotalReserves === undefined
    ) {
      return null;
    }

    const tvl = Number(rawTotalAssets) / USDC_DIVISOR;
    const totalDebt = Number(rawTotalBorrowed) / USDC_DIVISOR;
    const protocolReserves = Number(rawTotalReserves) / USDC_DIVISOR;

    // Calculate real total collateral: BridgedETH held by CollateralManager * ETH price
    let totalCollateral = 0;
    if (rawCollateralEth !== undefined && rawEthPrice !== undefined) {
      const collateralEth = Number(rawCollateralEth as bigint) / Number(WAD);
      const ethPrice = Number(rawEthPrice as bigint) / Number(WAD);
      totalCollateral = collateralEth * ethPrice;
    }

    return {
      tvl,
      totalCollateral,
      totalDebt,
      protocolReserves,
    };
  }, [rawTotalAssets, rawTotalBorrowed, rawTotalReserves, rawCollateralEth, rawEthPrice]);

  const refetch = useCallback(() => {
    refetchAssets();
    refetchBorrowed();
    refetchReserves();
    refetchCollateralEth();
    refetchEthPrice();
  }, [refetchAssets, refetchBorrowed, refetchReserves, refetchCollateralEth, refetchEthPrice]);

  return { data, isLoading, isError, refetch };
}
