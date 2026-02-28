"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { parseUnits } from "viem";
import { CHARIOT_ADDRESSES, LendingPoolABI } from "@chariot/shared";

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
  borrow: (amount: string) => void;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Hook for borrowing USDC from LendingPool.
 * Calls lendingPool.borrow(collateralToken, amount, priceUpdates) using real wagmi contract calls.
 * Uses an empty priceUpdates array since the protocol uses admin-set oracle prices.
 */
export function useBorrow(): UseBorrowReturn {
  const [status, setStatus] = useState<BorrowStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { address } = useAccount();

  // -- Write contract for borrow --
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
    if (isConfirmed && status === "borrowing") {
      setStatus("confirmed");
    }
  }, [isConfirmed, status]);

  // Transaction error
  useEffect(() => {
    if (writeError && status === "borrowing") {
      setStatus("error");
      setErrorMessage(
        "Borrow failed. No USDC was transferred. Check your collateral balance and try again."
      );
    }
  }, [writeError, status]);

  // -- Actions --

  const borrow = useCallback(
    (amount: string) => {
      if (!address) {
        setStatus("error");
        setErrorMessage("Wallet not connected.");
        return;
      }

      if (!amount || parseFloat(amount) <= 0) {
        setStatus("error");
        setErrorMessage("Invalid borrow amount.");
        return;
      }

      setStatus("borrowing");
      setErrorMessage(null);

      writeContract({
        address: CHARIOT_ADDRESSES.LENDING_POOL,
        abi: LendingPoolABI,
        functionName: "borrow",
        args: [
          CHARIOT_ADDRESSES.BRIDGED_ETH,
          parseUnits(amount, 6),
          [], // priceUpdates -- empty array, admin-set oracle
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

  return { status, txHash: hash ?? null, errorMessage, borrow, reset };
}
