"use client";

import { useState, useCallback } from "react";

export type RepayStatus =
  | "idle"
  | "approving"
  | "approved"
  | "repaying"
  | "confirmed"
  | "error";

interface UseRepayReturn {
  status: RepayStatus;
  txHash: string | null;
  errorMessage: string | null;
  needsApproval: boolean;
  /** Approve USDC spending for LendingPool */
  approve: () => Promise<void>;
  /** Execute partial repay */
  repay: (amount: string) => Promise<void>;
  /** Execute full repay (uses type(uint256).max) */
  repayFull: () => Promise<void>;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Hook for repaying USDC debt to LendingPool.
 * Handles USDC approval flow before repay.
 *
 * When ABIs are populated, replace with:
 * - useReadContract for USDC.allowance (check if approval needed)
 * - useWriteContract for USDC.approve(lendingPool, amount)
 * - useWriteContract for LendingPool.repay(amount) or LendingPool.repayFull()
 * - useWaitForTransactionReceipt for confirmation
 */
export function useRepay(): UseRepayReturn {
  const [status, setStatus] = useState<RepayStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(true);

  const approve = useCallback(async () => {
    try {
      setStatus("approving");
      setErrorMessage(null);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setNeedsApproval(false);
      setStatus("approved");
    } catch {
      setStatus("error");
      setErrorMessage(
        "Approval rejected. Your USDC is still in your wallet. Try approving again."
      );
    }
  }, []);

  const repay = useCallback(async (amount: string) => {
    try {
      setStatus("repaying");
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
        "Repay failed. Your USDC is still in your wallet. Check your balance and try again."
      );
    }
  }, []);

  const repayFull = useCallback(async () => {
    try {
      setStatus("repaying");
      setErrorMessage(null);

      await new Promise((resolve) => setTimeout(resolve, 2500));

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
        "Full repayment failed. Your USDC is still in your wallet. Try again."
      );
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setTxHash(null);
    setErrorMessage(null);
    setNeedsApproval(true);
  }, []);

  return {
    status,
    txHash,
    errorMessage,
    needsApproval,
    approve,
    repay,
    repayFull,
    reset,
  };
}
