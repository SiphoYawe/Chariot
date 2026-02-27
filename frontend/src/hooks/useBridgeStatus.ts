"use client";

import { useState, useEffect, useCallback } from "react";

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

const STEPS: BridgeStep[] = ["locked", "relayer", "minting", "deposited"];
const DELAY_THRESHOLD_MS = 120_000; // 2 minutes

/**
 * Hook for tracking the bridge progress from Sepolia to Arc.
 * Polls for BridgedETH balance on Arc to detect completion.
 * Uses mock progression until contracts are deployed.
 *
 * When ABIs are populated, replace with:
 * - useReadContract for BridgedETH.balanceOf on Arc (poll every 12s)
 * - useReadContract for CollateralManager.getCollateralBalance on Arc
 * - Compare against previous values to detect step transitions
 */
export function useBridgeStatus(nonce: number | null) {
  const [data, setData] = useState<BridgeStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (nonce === null) {
      setData(null);
      return;
    }

    setIsLoading(true);
    const startedAt = Date.now();
    let stepIndex = 0;

    // Simulate bridge progression
    const advance = () => {
      const elapsed = Date.now() - startedAt;
      const isDelayed = elapsed > DELAY_THRESHOLD_MS;

      if (stepIndex < STEPS.length - 1) {
        stepIndex++;
      }

      setData({
        currentStep: STEPS[stepIndex],
        stepIndex,
        isComplete: stepIndex === STEPS.length - 1,
        isDelayed,
        estimatedTimeRemaining:
          stepIndex < STEPS.length - 1
            ? Math.max(0, Math.ceil((30 - elapsed / 1000) * (STEPS.length - 1 - stepIndex)))
            : null,
        startedAt: Math.floor(startedAt / 1000),
      });
      setIsLoading(false);
    };

    // Initial state: locked
    setData({
      currentStep: "locked",
      stepIndex: 0,
      isComplete: false,
      isDelayed: false,
      estimatedTimeRemaining: 30,
      startedAt: Math.floor(startedAt / 1000),
    });
    setIsLoading(false);

    // Progress through steps
    const interval = setInterval(advance, 8000);

    return () => {
      clearInterval(interval);
    };
  }, [nonce]);

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
  }, []);

  return { data, isLoading, reset };
}
