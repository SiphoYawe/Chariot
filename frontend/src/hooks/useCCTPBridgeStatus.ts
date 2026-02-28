"use client";

import { useState, useEffect, useRef } from "react";

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
const DELAY_THRESHOLD_MS = 300_000; // 5 minutes for CCTP

/**
 * Hook for tracking CCTP bridge progress (USDC delivery).
 * Tracks: Burned on Arc -> Attestation Pending -> Minted on Destination
 *
 * Uses mock progression until attestation API integration.
 * When production-ready, replace with:
 * - Poll Circle Attestation API: GET /v2/messages?transactionHash=txHash
 * - Track attestation status transitions
 */
export function useCCTPBridgeStatus(txHash: string | null) {
  const [data, setData] = useState<CCTPBridgeStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Clear any existing interval
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
    const startedAt = Date.now();
    let stepIndex = 0;

    // Initial state: burned
    setData({
      currentStep: "burned",
      stepIndex: 0,
      isComplete: false,
      isDelayed: false,
      estimatedTimeRemaining: 30, // Mock: ~30s total to match mock progression
      startedAt: Math.floor(startedAt / 1000),
      destinationDomain: 0,
      txHash,
    });
    setIsLoading(false);

    // Simulate attestation progression
    const advance = () => {
      const elapsed = Date.now() - startedAt;
      const isDelayed = elapsed > DELAY_THRESHOLD_MS;

      if (stepIndex < STEPS.length - 1) {
        stepIndex++;
      }

      const isComplete = stepIndex === STEPS.length - 1;

      setData({
        currentStep: STEPS[stepIndex],
        stepIndex,
        isComplete,
        isDelayed,
        estimatedTimeRemaining: isComplete
          ? null
          : Math.max(0, 30 - Math.floor(elapsed / 1000)),
        startedAt: Math.floor(startedAt / 1000),
        destinationDomain: 0,
        txHash,
      });

      // Stop interval once complete
      if (isComplete && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Progress: burned (12s) -> attesting (12s) -> complete
    intervalRef.current = setInterval(advance, 12000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [txHash]);

  return { data, isLoading };
}
