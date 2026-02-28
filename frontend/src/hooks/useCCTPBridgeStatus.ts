"use client";

import { useState, useEffect, useRef } from "react";
import { CIRCLE_ATTESTATION_API } from "@chariot/shared";

export type CCTPBridgeStep = "burned" | "attesting" | "complete";

export interface CCTPBridgeStatusData {
  /** Current active step */
  currentStep: CCTPBridgeStep;
  /** Step index (0-2) */
  stepIndex: number;
  /** Whether the bridge is complete */
  isComplete: boolean;
  /** Whether the bridge is taking longer than expected */
  isDelayed: boolean;
  /** Estimated remaining time in seconds */
  estimatedTimeRemaining: number | null;
  /** Timestamp when bridge started */
  startedAt: number;
  /** Destination chain domain ID */
  destinationDomain: number;
  /** Transaction hash on source chain */
  txHash: string | null;
}

const STEPS: CCTPBridgeStep[] = ["burned", "attesting", "complete"];
const DELAY_THRESHOLD_S = 300; // 5 minutes for CCTP
const POLL_INTERVAL_MS = 15_000;

/**
 * Hook for tracking CCTP bridge progress (USDC delivery).
 * Polls Circle Attestation API for attestation status.
 * Steps: Burned on Arc -> Attestation Pending -> Minted on Destination
 */
export function useCCTPBridgeStatus(txHash: string | null) {
  const [data, setData] = useState<CCTPBridgeStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (txHash === null) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    startedAtRef.current = Math.floor(Date.now() / 1000);

    // Initial state: burned
    setData({
      currentStep: "burned",
      stepIndex: 0,
      isComplete: false,
      isDelayed: false,
      estimatedTimeRemaining: 120,
      startedAt: startedAtRef.current,
      destinationDomain: 0,
      txHash,
    });
    setIsLoading(false);

    // Poll Circle Attestation API
    const pollAttestation = async () => {
      try {
        const response = await fetch(
          `${CIRCLE_ATTESTATION_API}/v2/messages?transactionHash=${txHash}`
        );

        if (!response.ok) return;

        const result = await response.json();
        const messages = result?.messages ?? [];
        const elapsed = Math.floor(Date.now() / 1000) - startedAtRef.current;
        const isDelayed = elapsed > DELAY_THRESHOLD_S;

        if (messages.length === 0) {
          // Still waiting for attestation
          setData({
            currentStep: "attesting",
            stepIndex: 1,
            isComplete: false,
            isDelayed,
            estimatedTimeRemaining: Math.max(0, 120 - elapsed),
            startedAt: startedAtRef.current,
            destinationDomain: 0,
            txHash,
          });
          return;
        }

        const msg = messages[0];
        const status = msg.status;

        if (status === "complete") {
          setData({
            currentStep: "complete",
            stepIndex: 2,
            isComplete: true,
            isDelayed,
            estimatedTimeRemaining: null,
            startedAt: startedAtRef.current,
            destinationDomain: msg.destinationDomain ?? 0,
            txHash,
          });
          // Stop polling
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else {
          setData({
            currentStep: "attesting",
            stepIndex: 1,
            isComplete: false,
            isDelayed,
            estimatedTimeRemaining: Math.max(0, 120 - elapsed),
            startedAt: startedAtRef.current,
            destinationDomain: msg.destinationDomain ?? 0,
            txHash,
          });
        }
      } catch {
        // Network error -- keep polling, don't crash
      }
    };

    // Start polling after a short delay (attestation takes time)
    const timeout = setTimeout(() => {
      pollAttestation();
      intervalRef.current = setInterval(pollAttestation, POLL_INTERVAL_MS);
    }, 5000);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [txHash]);

  return { data, isLoading };
}
