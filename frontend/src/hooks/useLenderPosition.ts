"use client";

import { useState, useEffect, useCallback } from "react";

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

/**
 * Hook for fetching the lender's position data.
 * Uses mock data with 12s polling until contracts are deployed.
 *
 * When ABIs are populated, replace with:
 * - useReadContract for vault.balanceOf(user), vault.convertToAssets()
 * - useContractEvents for Deposit/Withdraw event logs to track original deposits
 */
export function useLenderPosition() {
  const [data, setData] = useState<LenderPositionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  // Mock: simulate a user with an active position
  // Set MOCK_HAS_POSITION to false to test EmptyState
  const MOCK_HAS_POSITION = true;

  useEffect(() => {
    let active = true;

    const load = () => {
      setTimeout(() => {
        if (!active) return;
        try {
          if (!MOCK_HAS_POSITION) {
            setData(null);
            setIsLoading(false);
            return;
          }

          // Mock position data -- simulates a user who deposited 5,000 USDC
          // and the share price has appreciated slightly
          const shareBalance = 5_000;
          const sharePrice = 1.0023; // Slight appreciation
          const positionValue = shareBalance * sharePrice;
          const originalDeposit = 5_000;
          const accruedEarnings = positionValue - originalDeposit;

          // Annualized APY (mock: 30 days elapsed)
          const daysElapsed = 30;
          const returnRate = positionValue / originalDeposit;
          const personalAPY =
            (Math.pow(returnRate, 365 / daysElapsed) - 1) * 100;

          setData({
            shareBalance,
            sharePrice,
            positionValue,
            originalDeposit,
            accruedEarnings,
            personalAPY,
          });
          setIsLoading(false);
        } catch {
          setIsError(true);
          setIsLoading(false);
        }
      }, 300);
    };

    load();
    const interval = setInterval(load, 12_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [MOCK_HAS_POSITION]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    setIsError(false);
  }, []);

  return { data, isLoading, isError, hasPosition: !!data, refetch };
}
