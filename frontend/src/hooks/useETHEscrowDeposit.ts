"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useSwitchChain,
  useChainId,
} from "wagmi";
import { parseEther } from "viem";
import { CHARIOT_ADDRESSES, ETHEscrowABI } from "@chariot/shared";

const SEPOLIA_CHAIN_ID = 11155111;

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
  deposit: (amount: string) => void;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Hook for depositing ETH into the ETHEscrow contract on Ethereum Sepolia.
 * Handles chain switching to Sepolia then calls ETHEscrow.deposit() with msg.value.
 */
export function useETHEscrowDeposit(): UseETHEscrowDepositReturn {
  const [status, setStatus] = useState<BridgeDepositStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nonce, setNonce] = useState<number | null>(null);
  const [pendingAmount, setPendingAmount] = useState<string | null>(null);

  const { address } = useAccount();
  const chainId = useChainId();

  // -- Switch chain --
  const {
    switchChain,
    isPending: isSwitching,
    isSuccess: isSwitchSuccess,
    error: switchError,
    reset: resetSwitch,
  } = useSwitchChain();

  // -- Write contract for deposit --
  const {
    writeContract,
    data: hash,
    isPending: isDepositPending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  // -- State machine transitions --

  // Chain switch succeeded -- proceed to deposit
  useEffect(() => {
    if (isSwitchSuccess && status === "switching-network" && pendingAmount) {
      setStatus("awaiting-deposit");
    }
  }, [isSwitchSuccess, status, pendingAmount]);

  // Once on Sepolia, auto-fire the deposit
  useEffect(() => {
    if (
      status === "awaiting-deposit" &&
      pendingAmount &&
      address
    ) {
      setStatus("depositing");

      writeContract({
        address: CHARIOT_ADDRESSES.ETH_ESCROW,
        abi: ETHEscrowABI,
        functionName: "deposit",
        value: parseEther(pendingAmount),
        chainId: SEPOLIA_CHAIN_ID,
      });
    }
  }, [status, pendingAmount, address, writeContract]);

  // Chain switch error
  useEffect(() => {
    if (switchError && status === "switching-network") {
      setStatus("error");
      setErrorMessage(
        "Failed to switch to Sepolia network. Please switch manually and try again."
      );
    }
  }, [switchError, status]);

  // Deposit confirmed -- extract nonce from logs
  useEffect(() => {
    if (isConfirmed && status === "depositing") {
      // Try to extract nonce from the Deposited event log
      if (receipt?.logs && receipt.logs.length > 0) {
        try {
          // The nonce is the first indexed topic in the Deposited event
          const depositedLog = receipt.logs[0];
          if (depositedLog.topics[1]) {
            const nonceValue = parseInt(depositedLog.topics[1], 16);
            setNonce(nonceValue);
          }
        } catch {
          // If parsing fails, nonce stays null
        }
      }
      setStatus("confirmed");
    }
  }, [isConfirmed, status, receipt]);

  // Deposit error
  useEffect(() => {
    if (writeError && status === "depositing") {
      setStatus("error");
      setErrorMessage(
        "Deposit failed. Your ETH is still in your wallet. Check your balance and try again."
      );
    }
  }, [writeError, status]);

  // -- Actions --

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

      setErrorMessage(null);
      setPendingAmount(amount);

      // If already on Sepolia, skip the switch
      if (chainId === SEPOLIA_CHAIN_ID) {
        setStatus("awaiting-deposit");
      } else {
        setStatus("switching-network");
        switchChain({ chainId: SEPOLIA_CHAIN_ID });
      }
    },
    [address, chainId, switchChain]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
    setNonce(null);
    setPendingAmount(null);
    resetSwitch();
    resetWrite();
  }, [resetSwitch, resetWrite]);

  return {
    status,
    txHash: hash ?? null,
    nonce,
    errorMessage,
    deposit,
    reset,
  };
}
