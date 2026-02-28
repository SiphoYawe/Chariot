"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

export interface StepConfig {
  label: string;
  status: "completed" | "active" | "pending";
}

interface TransactionStepperProps {
  steps: StepConfig[];
  /** Optional className */
  className?: string;
}

function StepIcon({ status }: { status: StepConfig["status"] }) {
  if (status === "completed") {
    return (
      <div className="w-7 h-7 bg-[#03B5AA] flex items-center justify-center shrink-0">
        <HugeiconsIcon icon={Tick02Icon} size={16} className="text-white" />
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="w-7 h-7 bg-[#03B5AA] flex items-center justify-center shrink-0">
        <span className="w-2.5 h-2.5 bg-white animate-pulse" style={{ borderRadius: "50%" }} />
      </div>
    );
  }

  return (
    <div className="w-7 h-7 border border-[rgba(3,121,113,0.15)] bg-[#F8FAFA] flex items-center justify-center shrink-0">
      <span className="w-2 h-2 bg-[#9CA3AF]" style={{ borderRadius: "50%" }} />
    </div>
  );
}

export function TransactionStepper({ steps, className }: TransactionStepperProps) {
  return (
    <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
      {/* Desktop: horizontal (>= lg) */}
      <div className="hidden lg:flex items-start">
        {steps.map((step, index) => (
          <div key={step.label} className="flex-1 flex flex-col items-center relative">
            {/* Connector line */}
            {index > 0 && (
              <div
                className="absolute top-3.5 right-1/2 w-full h-0.5"
                style={{
                  backgroundColor:
                    step.status === "completed" || step.status === "active"
                      ? "#03B5AA"
                      : "rgba(3, 121, 113, 0.15)",
                }}
              />
            )}

            {/* Step icon */}
            <div className="relative z-10">
              <StepIcon status={step.status} />
            </div>

            {/* Label */}
            <span
              className={cn(
                "text-xs mt-2 text-center font-[family-name:var(--font-heading)] max-w-[100px]",
                step.status === "completed" && "text-[#03B5AA] font-medium",
                step.status === "active" && "text-[#023436] font-semibold",
                step.status === "pending" && "text-[#6B8A8D]"
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* Mobile: vertical (< lg) */}
      <div className="flex lg:hidden flex-col gap-0">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-start gap-3">
            {/* Icon + connector */}
            <div className="flex flex-col items-center">
              <StepIcon status={step.status} />
              {index < steps.length - 1 && (
                <div
                  className="w-0.5 h-6"
                  style={{
                    backgroundColor:
                      steps[index + 1].status === "completed" || steps[index + 1].status === "active"
                        ? "#03B5AA"
                        : "rgba(3, 121, 113, 0.15)",
                  }}
                />
              )}
            </div>

            {/* Label */}
            <span
              className={cn(
                "text-sm font-[family-name:var(--font-heading)] pt-1",
                step.status === "completed" && "text-[#03B5AA] font-medium",
                step.status === "active" && "text-[#023436] font-semibold",
                step.status === "pending" && "text-[#6B8A8D]"
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
