"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EducationTooltip } from "@/components/feedback/EducationTooltip";
import { useRateBreakdown } from "@/hooks/useRateBreakdown";
import { useVaultMetrics } from "@/hooks/useVaultMetrics";
import { cn } from "@/lib/utils";

interface RateBreakdownProps {
  /** Optional className */
  className?: string;
}

function formatPercent(n: number): string {
  return (n * 100).toFixed(2) + "%";
}

export function RateBreakdown({ className }: RateBreakdownProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: vaultData, isLoading: vaultLoading, isError: vaultError, refetch } = useVaultMetrics();
  const { data: rateData, isLoading: rateLoading } = useRateBreakdown();

  const isLoading = vaultLoading || rateLoading;
  const totalRate = rateData ? rateData.totalRate : (vaultData ? vaultData.borrowRate / 100 : 0);

  if (isLoading) {
    return (
      <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-10 w-28 mb-3" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  if (vaultError) {
    return <ErrorState message="Unable to load rate data." onRetry={refetch} />;
  }

  return (
    <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
      <div className="flex items-center gap-1.5 mb-4">
        <h3 className="text-sm font-medium text-[#6B8A8D]">Borrow Rate</h3>
        <EducationTooltip term="borrowRate" />
      </div>

      {/* Headline rate */}
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-3xl font-bold text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
          {formatPercent(totalRate)}
        </span>
        <span className="text-sm text-[#6B8A8D]">APR</span>
      </div>

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
        Rate breakdown
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="space-y-2.5 pt-2 border-t border-[rgba(3,121,113,0.10)]">
          {/* Utilisation Rate */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs text-[#023436]">
              Utilisation Rate
              <EducationTooltip term="utilisation" />
            </span>
            <span className="text-xs text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
              {rateData ? formatPercent(rateData.baseRate) : formatPercent(totalRate)}
            </span>
          </div>

          {/* Volatility Premium */}
          <div className="flex items-center justify-between">
            <span className={cn("flex items-center gap-1 text-xs", rateData?.isPremiumActive ? "text-[#023436]" : "text-[#6B8A8D]")}>
              Volatility Premium
              <EducationTooltip term="volatilityPremium" />
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
