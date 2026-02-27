"use client";

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

      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-3xl font-bold text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
          {formatPercent(borrowRate)}
        </span>
        <span className="text-sm text-[#6B8A8D]">APR</span>
      </div>

      {/* Rate breakdown */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#023436]">Base utilisation rate</span>
          <span className="text-xs text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
            {formatPercent(borrowRate)}
          </span>
        </div>
        <div className="flex justify-between items-center opacity-40">
          <span className="text-xs text-[#6B8A8D]">Volatility premium</span>
          <span className="text-xs text-[#6B8A8D] font-[family-name:var(--font-heading)] tabular-nums">
            Phase 2
          </span>
        </div>
        <div className="flex justify-between items-center opacity-40">
          <span className="text-xs text-[#6B8A8D]">Concentration premium</span>
          <span className="text-xs text-[#6B8A8D] font-[family-name:var(--font-heading)] tabular-nums">
            Phase 3
          </span>
        </div>
      </div>
    </div>
  );
}
