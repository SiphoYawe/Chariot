"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EducationTooltip } from "@/components/feedback/EducationTooltip";
import { useVaultMetrics } from "@/hooks/useVaultMetrics";
import { cn } from "@/lib/utils";

interface YieldDisplayProps {
  /** Optional className */
  className?: string;
}

export function YieldDisplay({ className }: YieldDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, isError, refetch } = useVaultMetrics();

  const supplyAPY = data ? data.supplyAPY : 0;
  const tbillComponent = data ? data.tbillYieldComponent : 0;
  const borrowComponent = data ? data.borrowInterestComponent : 0;

  if (isLoading) {
    return (
      <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
        <Skeleton className="h-4 w-24 mb-4" />
        <Skeleton className="h-10 w-28 mb-3" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Failed to load yield data." onRetry={refetch} />;
  }

  // Visual proportions for the breakdown bar
  const total = tbillComponent + borrowComponent;
  const tbillPercent = total > 0 ? (tbillComponent / total) * 100 : 50;

  return (
    <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
      <div className="flex items-center gap-1.5 mb-4">
        <h3 className="text-sm font-medium text-[#6B8A8D]">Supply APY</h3>
        <EducationTooltip term="apy" />
      </div>

      {/* Headline APY */}
      <p className="text-4xl font-bold font-[family-name:var(--font-heading)] tabular-nums text-[#03B5AA] mb-3">
        {supplyAPY.toFixed(2)}%
      </p>

      {/* Expandable toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-[#037971] hover:text-[#03B5AA] transition-colors mb-2"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={cn("transition-transform duration-200", expanded && "rotate-90")}
        >
          <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
        </svg>
        APY breakdown
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="pt-2 border-t border-[rgba(3,121,113,0.10)] space-y-3">
          {/* Visual proportion bar */}
          <div className="h-2 flex w-full overflow-hidden">
            <div
              className="h-full bg-[#037971] transition-all duration-300"
              style={{ width: `${tbillPercent}%` }}
            />
            <div
              className="h-full bg-[#03B5AA] transition-all duration-300"
              style={{ width: `${100 - tbillPercent}%` }}
            />
          </div>

          {/* T-Bill Yield */}
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-[#6B8A8D]">
              <span className="w-2 h-2 bg-[#037971] shrink-0" />
              T-Bill Yield
              <EducationTooltip term="tbillYield" />
            </span>
            <span className="font-medium font-[family-name:var(--font-heading)] tabular-nums text-[#023436]">
              {tbillComponent.toFixed(2)}%
            </span>
          </div>

          {/* Borrower Interest */}
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-[#6B8A8D]">
              <span className="w-2 h-2 bg-[#03B5AA] shrink-0" />
              Borrower Interest
              <EducationTooltip term="supplyRate" />
            </span>
            <span className="font-medium font-[family-name:var(--font-heading)] tabular-nums text-[#023436]">
              {borrowComponent.toFixed(2)}%
            </span>
          </div>

          {/* Combined total */}
          <div className="border-t border-[rgba(3,121,113,0.15)] pt-2 flex items-center justify-between text-sm">
            <span className="font-medium text-[#023436]">Combined</span>
            <span className="font-semibold font-[family-name:var(--font-heading)] tabular-nums text-[#03B5AA]">
              {supplyAPY.toFixed(2)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
