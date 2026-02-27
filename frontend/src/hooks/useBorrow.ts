"use client";

import { useState, useCallback } from "react";

export type BorrowStatus =
  | "idle"
  | "borrowing"
  | "confirmed"
  | "error";

interface UseBorrowReturn {
  status: BorrowStatus;
  txHash: string | null;
  errorMessage: string | null;
  /** Execute borrow transaction */
  borrow: (amount: string) => Promise<void>;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Hook for borrowing USDC from LendingPool.
 * Uses mock logic until contracts are deployed.
 *
 * When ABIs are populated, replace with:
 * - Fetch Stork signed price data from REST API
 * - useWriteContract for LendingPool.borrow(collateralToken, amount, priceUpdates)
 * - useWaitForTransactionReceipt for confirmation
 */
export function useBorrow(): UseBorrowReturn {
  const [status, setStatus] = useState<BorrowStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const borrow = useCallback(async (amount: string) => {
    try {
      setStatus("borrowing");
      setErrorMessage(null);

      if (!amount || parseFloat(amount) <= 0) {
        throw new Error("Invalid amount");
      }

      // Mock: simulate borrow transaction
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
        "Borrow failed. No USDC was transferred. Check your collateral balance and try again."
      );
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setTxHash(null);
    setErrorMessage(null);
  }, []);

  return { status, txHash, errorMessage, borrow, reset };
}
