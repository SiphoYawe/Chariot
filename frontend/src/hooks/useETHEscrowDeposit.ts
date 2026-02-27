"use client";

import { useState, useCallback } from "react";

export type BridgeDepositStatus =
  | "idle"
  | "switching-network"
  | "awaiting-deposit"
  | "depositing"
  | "confirmed"
  | "error";

interface UseETHEscrowDepositReturn {
  status: BridgeDepositStatus;
  txHash: string | null;
  nonce: number | null;
  errorMessage: string | null;
  /** Initiate ETH deposit to ETHEscrow on Sepolia */
  deposit: (amount: string) => Promise<void>;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Hook for depositing ETH into the ETHEscrow contract on Ethereum Sepolia.
 * Uses mock logic until contracts are deployed.
 *
 * When ABIs are populated, replace with:
 * - useSwitchChain for network switching to Sepolia
 * - useWriteContract for ETHEscrow.deposit() with msg.value
 * - useWaitForTransactionReceipt for confirmation
 */
export function useETHEscrowDeposit(): UseETHEscrowDepositReturn {
  const [status, setStatus] = useState<BridgeDepositStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [nonce, setNonce] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deposit = useCallback(async (amount: string) => {
    try {
      setErrorMessage(null);

      if (!amount || parseFloat(amount) <= 0) {
        throw new Error("Invalid amount");
      }

      // Step 1: Switch network to Sepolia
      setStatus("switching-network");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 2: Await user confirmation
      setStatus("awaiting-deposit");
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step 3: Execute deposit transaction
      setStatus("depositing");
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Mock results
      const mockHash =
        "0x" +
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("");
      const mockNonce = Math.floor(Math.random() * 1000);

      setTxHash(mockHash);
      setNonce(mockNonce);
      setStatus("confirmed");
    } catch {
      setStatus("error");
      setErrorMessage(
        "Deposit failed. Your ETH is still in your wallet. Check your balance and try again."
      );
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setTxHash(null);
    setNonce(null);
    setErrorMessage(null);
  }, []);

  return {
    status,
    txHash,
    nonce,
    errorMessage,
    deposit,
    reset,
  };
}
