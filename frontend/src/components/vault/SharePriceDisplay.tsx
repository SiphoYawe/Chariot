"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { TrendIndicator } from "@/components/vault/TrendIndicator";
import { useLenderPosition } from "@/hooks/useLenderPosition";
import { useVaultMetrics } from "@/hooks/useVaultMetrics";
import { cn } from "@/lib/utils";

interface SharePriceDisplayProps {
  /** Optional className */
  className?: string;
}

export function SharePriceDisplay({ className }: SharePriceDisplayProps) {
  const {
    data: position,
    isLoading: positionLoading,
    isError: positionError,
    refetch: refetchPosition,
  } = useLenderPosition();
  const {
    data: metrics,
    isLoading: metricsLoading,
    isError: metricsError,
    refetch: refetchMetrics,
  } = useVaultMetrics();

  const isLoading = positionLoading || metricsLoading;
  const isError = positionError || metricsError;

  const refetch = () => {
    refetchPosition();
    refetchMetrics();
  };

  if (isLoading) {
    return (
      <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-8 w-40 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message="Unable to load share price data."
        onRetry={refetch}
      />
    );
  }

  const sharePrice = metrics?.sharePrice ?? 1.0;
  // Initial share price is always 1.0 USDC for ERC-4626 vaults
  const initialSharePrice = 1.0;
  const appreciation = position
    ? position.positionValue - position.originalDeposit
    : 0;

  return (
    <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
      <p className="text-xs font-medium text-[#6B8A8D] uppercase tracking-wider mb-3">
        chUSDC Share Price
      </p>

      {/* Share price value */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold font-[family-name:var(--font-heading)] tabular-nums text-[#023436]">
          ${sharePrice.toFixed(6)}
        </span>
        <TrendIndicator
          value={sharePrice}
          previousValue={initialSharePrice}
          format="usd"
        />
      </div>

      {/* User appreciation (only if they have a position) */}
      {position && appreciation > 0 && (
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-[rgba(3,121,113,0.10)]">
          <span className="text-xs text-[#6B8A8D]">Your Total Appreciation</span>
          <span className="text-sm font-semibold tabular-nums font-[family-name:var(--font-heading)] text-[#10B981]">
            +$
            {appreciation.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      )}
    </div>
  );
}
