"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useUserPosition } from "@/hooks/useUserPosition";

function formatUSDC(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function TopBorrowersList() {
  const { data: position, isLoading, isError, refetch } = useUserPosition();

  if (isLoading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-[120px] w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Unable to load your collateral position." onRetry={refetch} />;
  }

  if (!position || !position.isActive) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
          Your Collateral Position
        </h3>
        <p className="text-sm text-[#6B8A8D] text-center py-8">
          No position to display
        </p>
      </div>
    );
  }

  const ltvPct = (position.effectiveLtv * 100).toFixed(1);
  const ltvColor =
    position.effectiveLtv > 0.75
      ? "#DC2626"
      : position.effectiveLtv > 0.6
      ? "#F59E0B"
      : "#10B981";

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
        Your Collateral Position
      </h3>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#6B8A8D] uppercase tracking-wider">Collateral</span>
          <div className="text-right">
            <p className="text-sm tabular-nums font-[family-name:var(--font-heading)] text-[#023436] font-semibold">
              {position.collateralAmount.toFixed(4)} ETH
            </p>
            <p className="text-xs text-[#9CA3AF]">{formatUSDC(position.collateralValueUsdc)}</p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-[#6B8A8D] uppercase tracking-wider">Outstanding Debt</span>
          <p className="text-sm tabular-nums font-[family-name:var(--font-heading)] text-[#023436] font-semibold">
            {formatUSDC(position.outstandingDebt)}
          </p>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-[#6B8A8D] uppercase tracking-wider">Effective LTV</span>
          <p className="text-sm tabular-nums font-[family-name:var(--font-heading)] font-semibold" style={{ color: ltvColor }}>
            {ltvPct}%
          </p>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-[#6B8A8D] uppercase tracking-wider">Liquidation Price</span>
          <p className="text-sm tabular-nums font-[family-name:var(--font-heading)] text-[#023436] font-semibold">
            {position.liquidationPrice > 0 ? formatUSDC(position.liquidationPrice) : "--"}
          </p>
        </div>

        {/* LTV progress bar */}
        <div className="pt-1">
          <div className="w-full h-1.5 bg-[rgba(3,121,113,0.1)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(position.effectiveLtv * 100, 100)}%`, backgroundColor: ltvColor }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-[#9CA3AF]">0%</span>
            <span className="text-[10px] text-[#9CA3AF]">LTV 100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
