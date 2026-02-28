"use client";

import { cn } from "@/lib/utils";

interface LTVDisplayProps {
  /** Effective LTV (0-1, e.g., 0.70 = 70%) */
  effectiveLTV: number;
  /** Base LTV before adjustment (0-1) */
  baseLTV: number;
  /** Liquidation threshold (0-1) */
  liquidationThreshold: number;
  /** Whether the engine is available */
  isEngineAvailable: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Optional className */
  className?: string;
}

function formatPercent(n: number): string {
  return (n * 100).toFixed(2) + "%";
}

export function LTVDisplay({
  effectiveLTV,
  baseLTV,
  liquidationThreshold,
  isEngineAvailable,
  isLoading,
  className,
}: LTVDisplayProps) {
  const adjustmentMagnitude = baseLTV - effectiveLTV;
  const isAdjusted = adjustmentMagnitude > 0.0001; // threshold for floating point

  if (isLoading) {
    return (
      <div className={cn("space-y-1", className)}>
        <div className="h-6 w-16 bg-[#F8FAFA] animate-pulse" />
        <div className="h-4 w-32 bg-[#F8FAFA] animate-pulse" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {/* Primary LTV value */}
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
          {formatPercent(effectiveLTV)}
        </span>
        {isEngineAvailable && isAdjusted && (
          <span className="flex items-center gap-1 text-xs text-[#023436]">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="inline-block">
              <path d="M5 2L5 8M5 8L2 5M5 8L8 5" stroke="#023436" strokeWidth="1.5" strokeLinecap="square" />
            </svg>
            <span className="tabular-nums font-[family-name:var(--font-body)]">
              -{(adjustmentMagnitude * 100).toFixed(1)}% from {formatPercent(baseLTV)} base
            </span>
          </span>
        )}
        {isEngineAvailable && !isAdjusted && (
          <span className="text-xs text-[#6B8A8D] font-[family-name:var(--font-body)]">
            At baseline
          </span>
        )}
      </div>

      {/* Liquidation threshold */}
      <p className="text-xs text-[#6B8A8D] font-[family-name:var(--font-body)] tabular-nums">
        Liquidation at {formatPercent(liquidationThreshold)}
      </p>
    </div>
  );
}
