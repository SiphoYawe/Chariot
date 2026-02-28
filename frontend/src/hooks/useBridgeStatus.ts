"use client";

import { useState, useEffect, useCallback } from "react";
import { useReadContract } from "wagmi";
import { ETHEscrowABI, BridgedETHABI, CHARIOT_ADDRESSES } from "@chariot/shared";
import { useAccount } from "wagmi";

export type BridgeStep = "locked" | "relayer" | "minting" | "deposited";

interface BridgeStatusData {
  /** Current active step */
  currentStep: BridgeStep;
  /** Step index (0-3) */
  stepIndex: number;
  /** Whether the bridge is complete */
  isComplete: boolean;
  /** Whether the bridge is taking longer than expected */
  isDelayed: boolean;
  /** Estimated remaining time in seconds */
  estimatedTimeRemaining: number | null;
  /** Timestamp when bridge started */
  startedAt: number;
}

const ETH_ESCROW_SEPOLIA = CHARIOT_ADDRESSES.ETH_ESCROW;
const DELAY_THRESHOLD_S = 120; // 2 minutes
const ETH_SEPOLIA_CHAIN_ID = 11155111;

/**
 * Hook for tracking the ETH bridge progress from Sepolia to Arc.
 * Reads ETHEscrow.getDeposit(nonce) on Sepolia to check deposit status,
 * then polls BridgedETH balance on Arc to detect minting completion.
 */
export function useBridgeStatus(nonce: number | null) {
  const [startedAt] = useState(() => Math.floor(Date.now() / 1000));
  const { address } = useAccount();

  // Read deposit status from ETHEscrow on Sepolia
  const { data: depositData, isLoading: isDepositLoading } = useReadContract({
    address: ETH_ESCROW_SEPOLIA,
    abi: ETHEscrowABI,
    functionName: "getDeposit",
    args: nonce !== null ? [BigInt(nonce)] : undefined,
    chainId: ETH_SEPOLIA_CHAIN_ID,
    query: {
      enabled: nonce !== null,
      refetchInterval: 6_000,
    },
  });

  // Read BridgedETH balance on Arc to detect minting
  const { data: bridgedBalance } = useReadContract({
    address: CHARIOT_ADDRESSES.BRIDGED_ETH,
    abi: BridgedETHABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && nonce !== null,
      refetchInterval: 6_000,
    },
  });

  const [prevBalance] = useState<bigint | null>(null);
  const [data, setData] = useState<BridgeStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (nonce === null) {
      setData(null);
      return;
    }

    const elapsed = Math.floor(Date.now() / 1000) - startedAt;
    const isDelayed = elapsed > DELAY_THRESHOLD_S;

    // Determine step based on deposit status
    // Status enum: 0=Pending, 1=Processed, 2=Expired
    const deposit = depositData as { depositor: string; amount: bigint; timestamp: bigint; status: number } | undefined;
    const depositStatus = deposit ? Number(deposit.status) : 0;

    let currentStep: BridgeStep;
    let stepIndex: number;

    if (depositStatus === 0) {
      // Deposit pending -- locked on Sepolia
      currentStep = "locked";
      stepIndex = 0;
    } else if (depositStatus === 1) {
      // Deposit processed by relayer
      // Check if bridged balance increased (minting happened)
      if (bridgedBalance && prevBalance !== null && bridgedBalance > prevBalance) {
        currentStep = "deposited";
        stepIndex = 3;
      } else {
        currentStep = "minting";
        stepIndex = 2;
      }
    } else {
      // Expired or unknown
      currentStep = "locked";
      stepIndex = 0;
    }

    const isComplete = stepIndex === 3;

    setData({
      currentStep,
      stepIndex,
      isComplete,
      isDelayed,
      estimatedTimeRemaining: isComplete ? null : Math.max(0, 60 - elapsed),
      startedAt,
    });
    setIsLoading(isDepositLoading);
  }, [nonce, depositData, bridgedBalance, prevBalance, startedAt, isDepositLoading]);

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
  }, []);

  return { data, isLoading, reset };
}
