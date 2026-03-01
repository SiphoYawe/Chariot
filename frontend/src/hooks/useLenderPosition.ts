"use client";

import { useMemo, useCallback } from "react";
import { useReadContract, useAccount } from "wagmi";
import {
  ChariotVaultABI,
  LendingPoolABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
  USDC_ERC20_DECIMALS,
  RATE_MODEL,
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
  /** Personal APY -- uses the vault's current supply APY from the rate model */
  personalAPY: number;
}

const USDC_DIVISOR = 10 ** USDC_ERC20_DECIMALS;

/**
 * Hook for fetching the lender's position data.
 * Reads vault.balanceOf(user) for share balance and vault.convertToAssets(balance) for position value.
 * Earnings are calculated as positionValue - shareBalance (since initial deposit is 1:1).
 * APY uses the vault's current supply rate derived from the kinked interest rate model.
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

  // Read vault totalAssets and totalBorrowed to compute current supply APY
  const { data: rawTotalAssets } = useReadContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "totalAssets",
    query: { refetchInterval: POLLING_INTERVAL_MS },
  });

  const { data: rawTotalBorrowed } = useReadContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getTotalBorrowed",
    query: { refetchInterval: POLLING_INTERVAL_MS },
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

    // Use the vault's current supply APY from the kinked interest rate model.
    // This is the actual earning rate all lenders receive right now.
    let personalAPY = 0;
    if (rawTotalAssets !== undefined && rawTotalBorrowed !== undefined) {
      const totalAssets = Number(rawTotalAssets) / USDC_DIVISOR;
      const totalBorrowed = Number(rawTotalBorrowed) / USDC_DIVISOR;
      const utilisationFraction = totalAssets > 0 ? totalBorrowed / totalAssets : 0;

      let borrowRate: number;
      if (utilisationFraction <= RATE_MODEL.U_OPTIMAL) {
        borrowRate =
          RATE_MODEL.R_BASE +
          RATE_MODEL.R_SLOPE1 * (utilisationFraction / RATE_MODEL.U_OPTIMAL);
      } else {
        borrowRate =
          RATE_MODEL.R_BASE +
          RATE_MODEL.R_SLOPE1 +
          RATE_MODEL.R_SLOPE2 *
            ((utilisationFraction - RATE_MODEL.U_OPTIMAL) /
              (1 - RATE_MODEL.U_OPTIMAL));
      }

      const borrowComponent =
        borrowRate * utilisationFraction * (1 - RATE_MODEL.RESERVE_FACTOR);
      const tbillComponent =
        RATE_MODEL.USYC_YIELD *
        (1 - utilisationFraction) *
        (1 - RATE_MODEL.STRATEGY_FEE);
      personalAPY = (borrowComponent + tbillComponent) * 100;
    }

    return {
      shareBalance,
      sharePrice,
      positionValue,
      originalDeposit,
      accruedEarnings,
      personalAPY,
    };
  }, [address, rawShareBalance, rawPositionValue, rawTotalAssets, rawTotalBorrowed]);

  const refetch = useCallback(() => {
    refetchBalance();
    refetchConvert();
  }, [refetchBalance, refetchConvert]);

  return { data, isLoading, isError, hasPosition: !!data, refetch };
}
