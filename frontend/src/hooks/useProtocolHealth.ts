"use client";

import { useMemo, useCallback } from "react";
import { useReadContract } from "wagmi";
import {
  ChariotVaultABI,
  LendingPoolABI,
  BridgedETHABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
  USDC_ERC20_DECIMALS,
} from "@chariot/shared";
import { useMarketEthPrice } from "./useMarketEthPrice";

interface ProtocolHealthData {
  tvl: number;
  totalCollateral: number;
  totalDebt: number;
  protocolReserves: number;
}

const USDC_DIVISOR = 10 ** USDC_ERC20_DECIMALS;
const WAD = BigInt(10) ** BigInt(18);

export function useProtocolHealth() {
  const { price: ethPrice, isLoading: loadingEthPrice, isError: errorEthPrice } = useMarketEthPrice();

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

    let totalCollateral = 0;
    if (rawCollateralEth !== undefined && ethPrice !== null) {
      const collateralEth = Number(rawCollateralEth as bigint) / Number(WAD);
      totalCollateral = collateralEth * ethPrice;
    }

    return { tvl, totalCollateral, totalDebt, protocolReserves };
  }, [rawTotalAssets, rawTotalBorrowed, rawTotalReserves, rawCollateralEth, ethPrice]);

  const refetch = useCallback(() => {
    refetchAssets();
    refetchBorrowed();
    refetchReserves();
    refetchCollateralEth();
  }, [refetchAssets, refetchBorrowed, refetchReserves, refetchCollateralEth]);

  return { data, isLoading, isError, refetch };
}
