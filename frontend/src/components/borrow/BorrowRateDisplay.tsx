"use client";

import { useState } from "react";
import { useRateBreakdown } from "@/hooks/useRateBreakdown";
import { cn } from "@/lib/utils";

interface BorrowRateDisplayProps {
  /** Current borrow rate (0-1) */
  borrowRate: number;
  /** Current utilisation (0-1) */
  utilisation: number;
  /** Optional className */
  className?: string;
}

function formatPercent(n: number): string {
  return (n * 100).toFixed(2) + "%";
}

export function BorrowRateDisplay({
  borrowRate,
  utilisation,
  className,
}: BorrowRateDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: rateData } = useRateBreakdown();

  const totalRate = rateData ? rateData.totalRate : borrowRate;

  return (
    <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-[#6B8A8D] font-[family-name:var(--font-body)]">
          Borrow Rate
        </span>
        <span className="text-xs text-[#6B8A8D] tabular-nums font-[family-name:var(--font-heading)]">
          {formatPercent(utilisation)} utilisation
        </span>
      </div>

      {/* Headline rate */}
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-3xl font-bold text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
          {formatPercent(totalRate)}
        </span>
        <span className="text-sm text-[#6B8A8D]">APR</span>
      </div>

      {/* Expandable breakdown toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-[#037971] hover:text-[#03B5AA] transition-colors mb-2"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={cn("transition-transform", expanded && "rotate-90")}
        >
          <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
        </svg>
        Rate breakdown
      </button>

      {/* Rate breakdown (expandable) */}
      {expanded && (
        <div className="space-y-2 pt-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#023436]">Base utilisation rate</span>
            <span className="text-xs text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
              {rateData ? formatPercent(rateData.baseRate) : formatPercent(borrowRate)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className={cn("text-xs", rateData?.isPremiumActive ? "text-[#023436]" : "text-[#6B8A8D]")}>
              Volatility premium
            </span>
            {rateData?.isPremiumActive ? (
              <span className="text-xs text-[#03B5AA] font-[family-name:var(--font-heading)] tabular-nums">
                +{formatPercent(rateData.volatilityPremium)}
              </span>
            ) : (
              <span className="text-xs text-[#6B8A8D] font-[family-name:var(--font-heading)] tabular-nums">
                {rateData ? "0.00% (within baseline)" : "0.00%"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
