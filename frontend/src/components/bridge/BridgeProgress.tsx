"use client";

import { cn } from "@/lib/utils";
import type { BridgeStep } from "@/hooks/useBridgeStatus";
import { IconCircleCheckFilled, IconLoader2 } from "@tabler/icons-react";

interface BridgeProgressProps {
  /** Current active step */
  currentStep: BridgeStep;
  /** Whether bridge is complete */
  isComplete: boolean;
  /** Whether bridge is delayed */
  isDelayed: boolean;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining: number | null;
  /** Optional className */
  className?: string;
}

const STEPS: { key: BridgeStep; label: string; description: string }[] = [
  { key: "locked", label: "ETH Locked", description: "Deposit confirmed on Sepolia" },
  { key: "relayer", label: "Relayer Confirming", description: "Bridge relayer processing" },
  { key: "minting", label: "BridgedETH Minting", description: "Minting tokens on Arc" },
  { key: "deposited", label: "Collateral Deposited", description: "Ready to borrow" },
];

function getStepState(
  stepIndex: number,
  currentIndex: number,
  isComplete: boolean
): "completed" | "active" | "pending" {
  if (isComplete) return "completed";
  if (stepIndex < currentIndex) return "completed";
  if (stepIndex === currentIndex) return "active";
  return "pending";
}

export function BridgeProgress({
  currentStep,
  isComplete,
  isDelayed,
  estimatedTimeRemaining,
  className,
}: BridgeProgressProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
      <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-6">
        Bridge Progress
      </h3>

      {/* Step indicators -- horizontal */}
      <div className="flex items-start gap-0">
        {STEPS.map((step, index) => {
          const state = getStepState(index, currentIndex, isComplete);
          return (
            <div key={step.key} className="flex-1 flex flex-col items-center relative">
              {/* Connector line */}
              {index > 0 && (
                <div
                  className="absolute top-3 right-1/2 w-full h-0.5"
                  style={{
                    backgroundColor:
                      state === "completed" || (state === "active" && index <= currentIndex)
                        ? "#03B5AA"
                        : "rgba(3, 121, 113, 0.15)",
                  }}
                />
              )}

              {/* Step circle */}
              <div
                className={cn(
                  "relative z-10 w-6 h-6 flex items-center justify-center",
                  state === "completed" && "bg-[#03B5AA]",
                  state === "active" && "bg-[#03B5AA]",
                  state === "pending" && "bg-[#F8FAFA] border border-[rgba(3,121,113,0.15)]"
                )}
              >
                {state === "completed" && (
                  <IconCircleCheckFilled size={14} className="text-white" />
                )}
                {state === "active" && (
                  <IconLoader2 size={14} className="text-white animate-spin" />
                )}
                {state === "pending" && (
                  <span className="text-[10px] text-[#6B8A8D] font-medium">
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-xs mt-2 text-center font-[family-name:var(--font-heading)]",
                  state === "completed" && "text-[#03B5AA] font-medium",
                  state === "active" && "text-[#023436] font-semibold",
                  state === "pending" && "text-[#6B8A8D]"
                )}
              >
                {step.label}
              </span>

              {/* Description */}
              <span className="text-[10px] text-[#6B8A8D] mt-0.5 text-center max-w-[100px]">
                {step.description}
              </span>
            </div>
          );
        })}
      </div>

      {/* Delayed warning */}
      {isDelayed && !isComplete && (
        <div className="mt-6 bg-[rgba(217,119,6,0.08)] border border-[rgba(217,119,6,0.2)] p-3">
          <p className="text-xs text-[#D97706]">
            Bridge is taking longer than expected. Your ETH is locked and safe in the escrow.
            {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
              <> Estimated: {Math.ceil(estimatedTimeRemaining / 60)} minutes.</>
            )}
          </p>
        </div>
      )}

      {/* Completion message */}
      {isComplete && (
        <div className="mt-6 bg-[rgba(22,163,74,0.08)] border border-[rgba(22,163,74,0.2)] p-3">
          <p className="text-xs text-[#16A34A]">
            Bridge complete. Your BridgedETH has been deposited as collateral. You can now borrow USDC.
          </p>
        </div>
      )}
    </div>
  );
}
