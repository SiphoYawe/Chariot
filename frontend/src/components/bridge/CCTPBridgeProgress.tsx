"use client";

import { cn } from "@/lib/utils";
import type { CCTPBridgeStep } from "@/hooks/useCCTPBridgeStatus";
import { Tick02Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface CCTPBridgeProgressProps {
  /** Current active step */
  currentStep: CCTPBridgeStep;
  /** Whether bridge is complete */
  isComplete: boolean;
  /** Whether bridge is delayed */
  isDelayed: boolean;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining: number | null;
  /** Destination chain name */
  destinationChain: string;
  /** Transaction hash for explorer link */
  txHash?: string | null;
  /** Optional className */
  className?: string;
}

const STEPS: { key: CCTPBridgeStep; label: string; description: string }[] = [
  { key: "burned", label: "USDC Burned", description: "Burned on Arc via CCTP" },
  { key: "attesting", label: "Attestation Pending", description: "Circle verifying transfer" },
  { key: "complete", label: "USDC Minted", description: "Delivered to destination" },
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

export function CCTPBridgeProgress({
  currentStep,
  isComplete,
  isDelayed,
  estimatedTimeRemaining,
  destinationChain,
  txHash,
  className,
}: CCTPBridgeProgressProps) {
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
                  <HugeiconsIcon icon={Tick02Icon} size={14} className="text-white" />
                )}
                {state === "active" && (
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    size={14}
                    className="text-white animate-spin"
                  />
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
              <span className="text-[10px] text-[#6B8A8D] mt-0.5 text-center max-w-[120px]">
                {step.description}
              </span>
            </div>
          );
        })}
      </div>

      {/* Estimated time */}
      {!isComplete && estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
        <div className="mt-4 text-center">
          <span className="text-xs text-[#6B8A8D]">
            Estimated time remaining:{" "}
            <span className="text-[#023436] font-medium tabular-nums font-[family-name:var(--font-heading)]">
              ~{Math.ceil(estimatedTimeRemaining / 60)} min
            </span>
          </span>
        </div>
      )}

      {/* Delayed warning */}
      {isDelayed && !isComplete && (
        <div className="mt-4 bg-[rgba(217,119,6,0.08)] border border-[rgba(217,119,6,0.2)] p-3">
          <p className="text-xs text-[#D97706]">
            Your USDC is in transit and will arrive. Estimated:{" "}
            {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0
              ? `${Math.ceil(estimatedTimeRemaining / 60)} minutes.`
              : "a few more minutes."}
          </p>
          <a
            href="https://iris-api-sandbox.circle.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[#D97706] underline mt-1 inline-block"
          >
            Check CCTP status
          </a>
        </div>
      )}

      {/* Completion message with explorer link */}
      {isComplete && (
        <div className="mt-4 bg-[rgba(22,163,74,0.08)] border border-[rgba(22,163,74,0.2)] p-3">
          <p className="text-xs text-[#16A34A]">
            Bridge complete. Your USDC has been delivered to {destinationChain}.
          </p>
          {txHash && (
            <a
              href={`https://explorer.arc.money/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#16A34A] underline font-medium mt-1 inline-block"
            >
              View source tx on Arc explorer
            </a>
          )}
        </div>
      )}
    </div>
  );
}
