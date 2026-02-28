"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { parseUnits, pad } from "viem";
import { CHARIOT_ADDRESSES, LendingPoolABI } from "@chariot/shared";

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
  bridge: (amount: string, destinationDomain: number, recipientAddress: string) => void;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Hook for bridging USDC from Arc to other chains via CCTP.
 * Calls lendingPool.borrowAndBridge(collateralToken, amount, destinationDomain, mintRecipient, priceUpdates).
 *
 * Note: CCTP Bridge may not be deployed yet. The hook checks that the CCTP_BRIDGE
 * address is set before proceeding.
 */
export function useBridgeUSDC(): UseBridgeUSDCReturn {
  const [status, setStatus] = useState<BridgeUSDCStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const { address } = useAccount();

  // -- Write contract for borrowAndBridge --
  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({ hash });

  // -- State machine transitions --

  // Transaction confirmed
  useEffect(() => {
    if (isConfirmed && status === "bridging") {
      setStatus("confirmed");
      inFlightRef.current = false;
    }
  }, [isConfirmed, status]);

  // Transaction error
  useEffect(() => {
    if (writeError && status === "bridging") {
      setStatus("error");
      setErrorMessage(
        "Bridge failed. Your USDC is safe on Arc. Please try again."
      );
      inFlightRef.current = false;
    }
  }, [writeError, status]);

  // -- Actions --

  const bridge = useCallback(
    (amount: string, destinationDomain: number, recipientAddress: string) => {
      // Prevent concurrent invocations
      if (inFlightRef.current) return;

      if (!address) {
        setStatus("error");
        setErrorMessage("Wallet not connected.");
        return;
      }

      const parsed = parseFloat(amount);
      if (!amount || !Number.isFinite(parsed) || parsed <= 0) {
        setStatus("error");
        setErrorMessage("Invalid amount.");
        return;
      }

      if (!recipientAddress) {
        setStatus("error");
        setErrorMessage("Recipient address required.");
        return;
      }

      // Check that CCTP_BRIDGE is deployed
      if (!CHARIOT_ADDRESSES.CCTP_BRIDGE || CHARIOT_ADDRESSES.CCTP_BRIDGE === ("" as `0x${string}`)) {
        setStatus("error");
        setErrorMessage(
          "CCTP Bridge is not deployed yet. Bridging is not available at this time."
        );
        return;
      }

      inFlightRef.current = true;
      setStatus("bridging");
      setErrorMessage(null);

      // Convert recipient address to bytes32 (pad to 32 bytes)
      const mintRecipient = pad(recipientAddress as `0x${string}`, { size: 32 });

      writeContract({
        address: CHARIOT_ADDRESSES.LENDING_POOL,
        abi: LendingPoolABI,
        functionName: "borrowAndBridge",
        args: [
          CHARIOT_ADDRESSES.BRIDGED_ETH,
          parseUnits(amount, 6),
          destinationDomain,
          mintRecipient,
          [], // priceUpdates -- empty array, admin-set oracle
        ],
      });
    },
    [address, writeContract]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
    inFlightRef.current = false;
    resetWrite();
  }, [resetWrite]);

  return { status, txHash: hash ?? null, errorMessage, bridge, reset };
}
