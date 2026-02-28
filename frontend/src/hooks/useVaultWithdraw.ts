"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { parseUnits } from "viem";
import { CHARIOT_ADDRESSES, ChariotVaultABI } from "@chariot/shared";

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
  withdraw: (amount: string) => void;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Hook for withdrawing USDC from the ChariotVault.
 * Calls vault.withdraw(assets, receiver, owner) using real wagmi contract calls.
 */
export function useVaultWithdraw(): UseVaultWithdrawReturn {
  const [status, setStatus] = useState<WithdrawStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { address } = useAccount();

  // -- Write contract for withdraw --
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
        "Withdrawal failed. Your chUSDC is still in the vault. Check your balance and try again."
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
        address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
        abi: ChariotVaultABI,
        functionName: "withdraw",
        args: [parseUnits(amount, 6), address, address],
      });
    },
    [address, writeContract]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
    resetWrite();
  }, [resetWrite]);

  return {
    status,
    txHash: hash ?? null,
    errorMessage,
    withdraw,
    reset,
  };
}
