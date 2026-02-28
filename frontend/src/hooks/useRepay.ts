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
  LendingPoolABI,
} from "@chariot/shared";

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
  approve: () => void;
  /** Execute partial repay */
  repay: (amount: string) => void;
  /** Execute full repay (uses repayFull on the contract) */
  repayFull: () => void;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Hook for repaying USDC debt to LendingPool.
 * Handles the approve-then-repay two-step flow using real wagmi contract calls.
 */
export function useRepay(): UseRepayReturn {
  const [status, setStatus] = useState<RepayStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [repayAmount, setRepayAmount] = useState<string>("0");

  const { address } = useAccount();

  // -- Read USDC allowance for the lending pool --
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: ADDRESSES.USDC as `0x${string}`,
    abi: ERC20ABI,
    functionName: "allowance",
    args: [address!, CHARIOT_ADDRESSES.LENDING_POOL],
    query: { enabled: !!address },
  });

  const needsApproval =
    allowance !== undefined
      ? (allowance as bigint) < parseUnits(repayAmount, 6)
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

  // -- Repay --
  const {
    writeContract: writeRepay,
    data: repayHash,
    isPending: isRepayPending,
    error: repayError,
    reset: resetRepay,
  } = useWriteContract();

  const {
    isLoading: isRepayConfirming,
    isSuccess: isRepayConfirmed,
  } = useWaitForTransactionReceipt({ hash: repayHash });

  // -- State machine transitions --

  // Approval confirmed
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
        "Approval rejected. Your USDC is still in your wallet. Try approving again."
      );
    }
  }, [approveError, status]);

  // Repay confirmed
  useEffect(() => {
    if (isRepayConfirmed && status === "repaying") {
      setStatus("confirmed");
    }
  }, [isRepayConfirmed, status]);

  // Repay error
  useEffect(() => {
    if (repayError && status === "repaying") {
      setStatus("error");
      setErrorMessage(
        "Repay failed. Your USDC is still in your wallet. Check your balance and try again."
      );
    }
  }, [repayError, status]);

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
      args: [CHARIOT_ADDRESSES.LENDING_POOL, parseUnits(repayAmount, 6)],
    });
  }, [address, repayAmount, writeApprove]);

  const repay = useCallback(
    (amount: string) => {
      if (!address) {
        setStatus("error");
        setErrorMessage("Wallet not connected.");
        return;
      }

      if (!amount || parseFloat(amount) <= 0) {
        setStatus("error");
        setErrorMessage("Invalid repay amount.");
        return;
      }

      setRepayAmount(amount);
      setStatus("repaying");
      setErrorMessage(null);

      writeRepay({
        address: CHARIOT_ADDRESSES.LENDING_POOL,
        abi: LendingPoolABI,
        functionName: "repay",
        args: [parseUnits(amount, 6)],
      });
    },
    [address, writeRepay]
  );

  const repayFull = useCallback(() => {
    if (!address) {
      setStatus("error");
      setErrorMessage("Wallet not connected.");
      return;
    }

    setStatus("repaying");
    setErrorMessage(null);

    writeRepay({
      address: CHARIOT_ADDRESSES.LENDING_POOL,
      abi: LendingPoolABI,
      functionName: "repayFull",
      args: [],
    });
  }, [address, writeRepay]);

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
    setRepayAmount("0");
    resetApprove();
    resetRepay();
  }, [resetApprove, resetRepay]);

  return {
    status,
    txHash: repayHash ?? approveHash ?? null,
    errorMessage,
    needsApproval,
    approve,
    repay,
    repayFull,
    reset,
  };
}
