"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { parseUnits } from "viem";
import { CHARIOT_ADDRESSES, CollateralManagerABI } from "@chariot/shared";

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
  withdraw: (amount: string) => void;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Hook for withdrawing BridgedETH collateral from CollateralManager.
 * Only available when user has zero debt.
 * Note: BridgedETH uses 18 decimals.
 */
export function useWithdrawCollateral(): UseWithdrawCollateralReturn {
  const [status, setStatus] = useState<WithdrawStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { address } = useAccount();

  // -- Write contract for withdrawCollateral --
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
    if (isConfirmed && status === "withdrawing") {
      setStatus("confirmed");
    }
  }, [isConfirmed, status]);

  // Transaction error
  useEffect(() => {
    if (writeError && status === "withdrawing") {
      setStatus("error");
      setErrorMessage(
        "Withdrawal failed. Your collateral is still deposited. Check your debt status and try again."
      );
    }
  }, [writeError, status]);

  // -- Actions --

  const withdraw = useCallback(
    (amount: string) => {
      if (!address) {
        setStatus("error");
        setErrorMessage("Wallet not connected.");
        return;
      }

      if (!amount || parseFloat(amount) <= 0) {
        setStatus("error");
        setErrorMessage("Invalid withdrawal amount.");
        return;
      }

      setStatus("withdrawing");
      setErrorMessage(null);

      writeContract({
        address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
        abi: CollateralManagerABI,
        functionName: "withdrawCollateral",
        args: [
          CHARIOT_ADDRESSES.BRIDGED_ETH,
          parseUnits(amount, 18), // BridgedETH uses 18 decimals
        ],
      });
    },
    [address, writeContract]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
    resetWrite();
  }, [resetWrite]);

  return { status, txHash: hash ?? null, errorMessage, withdraw, reset };
}
