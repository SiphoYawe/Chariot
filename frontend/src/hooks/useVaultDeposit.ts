"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
} from "wagmi";
import { parseUnits } from "viem";
import {
  ADDRESSES,
  CHARIOT_ADDRESSES,
  ERC20ABI,
  ChariotVaultABI,
} from "@chariot/shared";

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
  /** Whether USDC approval is needed for the vault */
  needsApproval: boolean;
  /** Approve USDC spending */
  approve: () => void;
  /** Execute the deposit */
  deposit: (amount: string) => void;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Hook for depositing USDC into the ChariotVault.
 * Handles the approve-then-deposit two-step flow using real wagmi contract calls.
 */
export function useVaultDeposit(): UseVaultDepositReturn {
  const [status, setStatus] = useState<DepositStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>("0");

  const { address } = useAccount();

  // -- Read USDC allowance for the vault --
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: ADDRESSES.USDC as `0x${string}`,
    abi: ERC20ABI,
    functionName: "allowance",
    args: [address!, CHARIOT_ADDRESSES.CHARIOT_VAULT],
    query: { enabled: !!address },
  });

  const needsApproval =
    allowance !== undefined
      ? (allowance as bigint) < parseUnits(depositAmount, 6)
      : true;

  // -- Approve USDC --
  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  const {
    isLoading: isApproveConfirming,
    isSuccess: isApproveConfirmed,
  } = useWaitForTransactionReceipt({ hash: approveHash });

  // -- Deposit into vault --
  const {
    writeContract: writeDeposit,
    data: depositHash,
    isPending: isDepositPending,
    error: depositError,
    reset: resetDeposit,
  } = useWriteContract();

  const {
    isLoading: isDepositConfirming,
    isSuccess: isDepositConfirmed,
  } = useWaitForTransactionReceipt({ hash: depositHash });

  // -- State machine transitions --

  // Approval submitted -- waiting for confirmation
  useEffect(() => {
    if (isApprovePending && status === "approving") {
      // still approving, no transition needed
    }
  }, [isApprovePending, status]);

  // Approval confirmed -- move to approved
  useEffect(() => {
    if (isApproveConfirmed && status === "approving") {
      refetchAllowance();
      setStatus("approved");
    }
  }, [isApproveConfirmed, status, refetchAllowance]);

  // Approval error
  useEffect(() => {
    if (approveError && status === "approving") {
      setStatus("error");
      setErrorMessage(
        "Approval was rejected. Your USDC is still in your wallet. Try approving again."
      );
    }
  }, [approveError, status]);

  // Deposit confirmed
  useEffect(() => {
    if (isDepositConfirmed && status === "depositing") {
      setStatus("confirmed");
    }
  }, [isDepositConfirmed, status]);

  // Deposit error
  useEffect(() => {
    if (depositError && status === "depositing") {
      setStatus("error");
      setErrorMessage(
        "Deposit failed. Your USDC is still in your wallet. Check your balance and try again."
      );
    }
  }, [depositError, status]);

  // -- Actions --

  const approve = useCallback(() => {
    if (!address) {
      setStatus("error");
      setErrorMessage("Wallet not connected.");
      return;
    }

    setStatus("approving");
    setErrorMessage(null);

    writeApprove({
      address: ADDRESSES.USDC as `0x${string}`,
      abi: ERC20ABI,
      functionName: "approve",
      args: [CHARIOT_ADDRESSES.CHARIOT_VAULT, parseUnits(depositAmount, 6)],
    });
  }, [address, depositAmount, writeApprove]);

  const deposit = useCallback(
    (amount: string) => {
      if (!address) {
        setStatus("error");
        setErrorMessage("Wallet not connected.");
        return;
      }

      if (!amount || parseFloat(amount) <= 0) {
        setStatus("error");
        setErrorMessage("Invalid deposit amount.");
        return;
      }

      setDepositAmount(amount);
      setStatus("depositing");
      setErrorMessage(null);

      writeDeposit({
        address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
        abi: ChariotVaultABI,
        functionName: "deposit",
        args: [parseUnits(amount, 6), address],
      });
    },
    [address, writeDeposit]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
    setDepositAmount("0");
    resetApprove();
    resetDeposit();
  }, [resetApprove, resetDeposit]);

  return {
    status,
    txHash: depositHash ?? approveHash ?? null,
    errorMessage,
    needsApproval,
    approve,
    deposit,
    reset,
  };
}
