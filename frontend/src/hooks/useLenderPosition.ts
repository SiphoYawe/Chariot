"use client";

import { useMemo, useCallback } from "react";
import { useReadContract, useAccount } from "wagmi";
import {
  ChariotVaultABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
  USDC_ERC20_DECIMALS,
} from "@chariot/shared";

interface LenderPositionData {
  /** chUSDC share balance */
  shareBalance: number;
  /** Current share price in USDC */
  sharePrice: number;
  /** Current position value in USDC (shares * sharePrice) */
  positionValue: number;
  /** Original deposit amount in USDC (net of withdrawals) */
  originalDeposit: number;
  /** Accrued earnings = positionValue - originalDeposit */
  accruedEarnings: number;
  /** Personal APY (annualized return) */
  personalAPY: number;
}

const USDC_DIVISOR = 10 ** USDC_ERC20_DECIMALS;

/**
 * Hook for fetching the lender's position data.
 * Reads vault.balanceOf(user) for share balance and vault.convertToAssets(balance) for position value.
 * Earnings are calculated as positionValue - shareBalance (since initial deposit is 1:1).
 */
export function useLenderPosition() {
  const { address } = useAccount();

  const {
    data: rawShareBalance,
    isLoading: loadingBalance,
    isError: errorBalance,
    refetch: refetchBalance,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "balanceOf",
    args: [address!],
    query: {
      enabled: !!address,
      refetchInterval: POLLING_INTERVAL_MS,
    },
  });

  const {
    data: rawPositionValue,
    isLoading: loadingConvert,
    isError: errorConvert,
    refetch: refetchConvert,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "convertToAssets",
    args: [rawShareBalance ?? BigInt(0)],
    query: {
      enabled: !!address && rawShareBalance !== undefined,
      refetchInterval: POLLING_INTERVAL_MS,
    },
  });

  const isLoading = !address ? false : loadingBalance || loadingConvert;
  const isError = errorBalance || errorConvert;

  const data = useMemo((): LenderPositionData | null => {
    if (!address) return null;
    if (rawShareBalance === undefined || rawPositionValue === undefined) return null;

    const shareBalance = Number(rawShareBalance) / USDC_DIVISOR;
    const positionValue = Number(rawPositionValue) / USDC_DIVISOR;

    // If user has no shares, return null (no position)
    if (shareBalance === 0) return null;

    // Share price = positionValue / shareBalance
    const sharePrice = shareBalance > 0 ? positionValue / shareBalance : 1.0;

    // Original deposit approximation: shares were minted 1:1 at deposit time,
    // so original deposit ~= shareBalance (in USDC terms)
    const originalDeposit = shareBalance;
    const accruedEarnings = positionValue - originalDeposit;

    // Personal APY approximation: based on share price appreciation
    // Without on-chain deposit timestamp, we estimate conservatively
    // If sharePrice > 1, there has been yield
    const personalAPY =
      sharePrice > 1.0 ? (sharePrice - 1.0) * 365 * 100 : 0;

    return {
      shareBalance,
      sharePrice,
      positionValue,
      originalDeposit,
      accruedEarnings,
      personalAPY,
    };
  }, [address, rawShareBalance, rawPositionValue]);

  const refetch = useCallback(() => {
    refetchBalance();
    refetchConvert();
  }, [refetchBalance, refetchConvert]);

  return { data, isLoading, isError, hasPosition: !!data, refetch };
}
