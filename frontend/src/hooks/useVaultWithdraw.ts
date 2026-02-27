"use client";

import { useState, useCallback } from "react";

export type WithdrawStatus =
  | "idle"
  | "withdrawing"
  | "confirmed"
  | "error";

interface UseVaultWithdrawReturn {
  status: WithdrawStatus;
  txHash: string | null;
  errorMessage: string | null;
  /** Execute the withdrawal */
  withdraw: (amount: string) => Promise<void>;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Hook for withdrawing USDC from the ChariotVault.
 * Uses mock logic until contracts are deployed.
 *
 * When ABIs are populated, replace with:
 * - useWriteContract for vault.withdraw(assets, receiver, owner)
 * - useWaitForTransactionReceipt for confirmation
 */
export function useVaultWithdraw(): UseVaultWithdrawReturn {
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

      // Mock: simulate withdrawal transaction
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Mock transaction hash
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
        "Withdrawal failed. Your chUSDC is still in the vault. Check your balance and try again."
      );
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setTxHash(null);
    setErrorMessage(null);
  }, []);

  return {
    status,
    txHash,
    errorMessage,
    withdraw,
    reset,
  };
}
