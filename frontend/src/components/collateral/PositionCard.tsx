"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface PositionCardProps {
  /** chUSDC share balance */
  shareBalance: number;
  /** Current share price in USDC */
  sharePrice: number;
  /** Current position value in USDC */
  positionValue: number;
  /** Original deposit in USDC */
  originalDeposit: number;
  /** Accrued earnings in USDC */
  accruedEarnings: number;
  /** Personal APY percentage */
  personalAPY: number;
  /** Loading state */
  loading?: boolean;
  /** Compact mode for dashboard embedding */
  compact?: boolean;
}

function formatUSDC(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PositionCard({
  shareBalance,
  sharePrice,
  positionValue,
  originalDeposit,
  accruedEarnings,
  personalAPY,
  loading,
  compact,
}: PositionCardProps) {
  if (loading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-24 mb-4" />
        <Skeleton className="h-8 w-32 mb-3" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-[#6B8A8D] uppercase tracking-wider">
          Your Position
        </p>
        <span className="text-xs font-medium text-[#03B5AA] tabular-nums font-[family-name:var(--font-heading)]">
          {personalAPY.toFixed(2)}% APY
        </span>
      </div>

      {/* Primary: Position value */}
      <p className="text-2xl font-bold font-[family-name:var(--font-heading)] tabular-nums text-[#023436] mb-1">
        ${formatUSDC(positionValue)}
      </p>
      <p className="text-sm text-[#10B981] tabular-nums font-[family-name:var(--font-heading)] mb-4">
        +${formatUSDC(accruedEarnings)} earned
      </p>

      {/* Detail grid */}
      {!compact && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-4 border-t border-[rgba(3,121,113,0.10)]">
          <div>
            <p className="text-xs text-[#6B8A8D] mb-0.5">chUSDC Balance</p>
            <p className="text-sm font-medium tabular-nums font-[family-name:var(--font-heading)] text-[#023436]">
              {formatUSDC(shareBalance)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#6B8A8D] mb-0.5">Share Price</p>
            <p className="text-sm font-medium tabular-nums font-[family-name:var(--font-heading)] text-[#023436]">
              ${sharePrice.toFixed(6)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#6B8A8D] mb-0.5">Original Deposit</p>
            <p className="text-sm font-medium tabular-nums font-[family-name:var(--font-heading)] text-[#023436]">
              ${formatUSDC(originalDeposit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#6B8A8D] mb-0.5">Earnings</p>
            <p className="text-sm font-medium tabular-nums font-[family-name:var(--font-heading)] text-[#10B981]">
              +${formatUSDC(accruedEarnings)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
