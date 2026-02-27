"use client";

import { useState, useCallback } from "react";

export type WithdrawStatus =
  | "idle"
  | "withdrawing"
  | "confirmed"
  | "error";

interface UseWithdrawCollateralReturn {
  status: WithdrawStatus;
  txHash: string | null;
  errorMessage: string | null;
  /** Execute collateral withdrawal */
  withdraw: (amount: string) => Promise<void>;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Hook for withdrawing BridgedETH collateral from CollateralManager.
 * Only available when user has zero debt.
 *
 * When ABIs are populated, replace with:
 * - useWriteContract for CollateralManager.withdrawCollateral(token, amount)
 * - useWaitForTransactionReceipt for confirmation
 */
export function useWithdrawCollateral(): UseWithdrawCollateralReturn {
  const [status, setStatus] = useState<WithdrawStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const withdraw = useCallback(async (amount: string) => {
    try {
      setStatus("withdrawing");
      setErrorMessage(null);

      if (!amount || parseFloat(amount) <= 0) {
        throw new Error("Invalid amount");
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockHash =
        "0x" +
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("");

      setTxHash(mockHash);
      setStatus("confirmed");
    } catch {
      setStatus("error");
      setErrorMessage(
        "Withdrawal failed. Your collateral is still deposited. Check your debt status and try again."
      );
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setTxHash(null);
    setErrorMessage(null);
  }, []);

  return { status, txHash, errorMessage, withdraw, reset };
}
