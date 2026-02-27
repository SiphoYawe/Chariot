"use client";

import { useState, useCallback } from "react";

export type DepositStatus =
  | "idle"
  | "approving"
  | "approved"
  | "depositing"
  | "confirmed"
  | "error";

interface UseVaultDepositReturn {
  status: DepositStatus;
  txHash: string | null;
  errorMessage: string | null;
  /** Whether USDC is approved for the vault */
  needsApproval: boolean;
  /** Approve USDC spending */
  approve: () => Promise<void>;
  /** Execute the deposit */
  deposit: (amount: string) => Promise<void>;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Hook for depositing USDC into the ChariotVault.
 * Uses mock logic until contracts are deployed.
 *
 * When ABIs are populated, replace with:
 * - useReadContract for USDC.allowance
 * - useWriteContract for USDC.approve and vault.deposit
 * - useWaitForTransactionReceipt for confirmation
 */
export function useVaultDeposit(): UseVaultDepositReturn {
  const [status, setStatus] = useState<DepositStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(true);

  const approve = useCallback(async () => {
    try {
      setStatus("approving");
      setErrorMessage(null);

      // Mock: simulate wallet approval delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setNeedsApproval(false);
      setStatus("approved");
    } catch {
      setStatus("error");
      setErrorMessage(
        "Approval was rejected. Your USDC is still in your wallet. Try approving again."
      );
    }
  }, []);

  const deposit = useCallback(async (amount: string) => {
    try {
      setStatus("depositing");
      setErrorMessage(null);

      if (!amount || parseFloat(amount) <= 0) {
        throw new Error("Invalid amount");
      }

      // Mock: simulate deposit transaction
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
        "Deposit failed. Your USDC is still in your wallet. Check your balance and try again."
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
    deposit,
    reset,
  };
}
