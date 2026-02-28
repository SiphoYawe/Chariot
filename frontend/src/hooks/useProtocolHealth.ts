"use client";

import { useMemo, useCallback } from "react";
import { useReadContract } from "wagmi";
import {
  ChariotVaultABI,
  LendingPoolABI,
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

  const isLoading = loadingAssets || loadingBorrowed || loadingReserves;
  const isError = errorAssets || errorBorrowed || errorReserves;

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
    // totalCollateral is approximated as totalDebt (borrowers deposited collateral to borrow)
    // In a more complete implementation this would sum all collateral values
    const totalCollateral = totalDebt;

    return {
      tvl,
      totalCollateral,
      totalDebt,
      protocolReserves,
    };
  }, [rawTotalAssets, rawTotalBorrowed, rawTotalReserves]);

  const refetch = useCallback(() => {
    refetchAssets();
    refetchBorrowed();
    refetchReserves();
  }, [refetchAssets, refetchBorrowed, refetchReserves]);

  return { data, isLoading, isError, refetch };
}
