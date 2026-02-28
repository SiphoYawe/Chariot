"use client";

import { useState, useCallback, useRef } from "react";

export type BridgeUSDCStatus =
  | "idle"
  | "approving"
  | "bridging"
  | "confirmed"
  | "error";

interface UseBridgeUSDCReturn {
  status: BridgeUSDCStatus;
  txHash: string | null;
  errorMessage: string | null;
  /** Execute bridge USDC transaction */
  bridge: (amount: string, destinationDomain: number, recipientAddress: string) => Promise<void>;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Hook for bridging USDC from Arc to other chains via CCTP.
 * Calls CCTPBridge.bridgeUSDC or LendingPool.borrowAndBridge.
 *
 * Uses mock logic until contracts are deployed.
 * When ABIs are populated, replace with:
 * - useWriteContract for USDC.approve(CCTPBridge, amount)
 * - useWriteContract for CCTPBridge.bridgeUSDC(amount, domain, recipient)
 * - useWaitForTransactionReceipt for confirmation
 */
export function useBridgeUSDC(): UseBridgeUSDCReturn {
  const [status, setStatus] = useState<BridgeUSDCStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const bridge = useCallback(
    async (amount: string, destinationDomain: number, recipientAddress: string) => {
      // Prevent concurrent invocations
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        setErrorMessage(null);

        const parsed = parseFloat(amount);
        if (!amount || !Number.isFinite(parsed) || parsed <= 0) {
          throw new Error("Invalid amount");
        }

        if (!recipientAddress) {
          throw new Error("Recipient address required");
        }

        // Step 1: Approve USDC
        setStatus("approving");
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Step 2: Bridge USDC
        setStatus("bridging");
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Mock tx hash
        const mockHash =
          "0x" +
          Array.from({ length: 64 }, () =>
            Math.floor(Math.random() * 16).toString(16)
          ).join("");

        setTxHash(mockHash);
        setStatus("confirmed");
      } catch (err) {
        setStatus("error");
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Bridge failed. Your USDC is safe on Arc. Please try again."
        );
      } finally {
        inFlightRef.current = false;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setTxHash(null);
    setErrorMessage(null);
    inFlightRef.current = false;
  }, []);

  return { status, txHash, errorMessage, bridge, reset };
}
