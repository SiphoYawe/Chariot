"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface FeeBreakdownProps {
  /** Estimated gas fee in USDC (6 decimal precision) */
  gasEstimate: number | null;
  /** Bridge fee in USDC (optional -- only for cross-chain) */
  bridgeFee?: number | null;
  /** Protocol fee in USDC (optional) */
  protocolFee?: number | null;
  /** Whether fees are still loading */
  loading?: boolean;
  /** Optional className */
  className?: string;
}

function formatFeeUSDC(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
}

export function FeeBreakdown({
  gasEstimate,
  bridgeFee,
  protocolFee,
  loading,
  className,
}: FeeBreakdownProps) {
  const fees: { label: string; value: number | null }[] = [
    { label: "Estimated Gas", value: gasEstimate },
  ];

  if (bridgeFee !== undefined) {
    fees.push({ label: "Bridge Fee", value: bridgeFee ?? null });
  }

  if (protocolFee !== undefined) {
    fees.push({ label: "Protocol Fee", value: protocolFee ?? null });
  }

  const totalFees = fees.reduce((sum, f) => sum + (f.value ?? 0), 0);
  const hasAnyFees = fees.some((f) => f.value !== null && f.value > 0);

  if (loading) {
    return (
      <div className={cn("bg-[#F8FAFA] border border-[rgba(3,121,113,0.15)] p-4 space-y-2", className)}>
        <p className="text-xs font-medium text-[#6B8A8D] uppercase tracking-wider">
          Fee Breakdown
        </p>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  if (!hasAnyFees && gasEstimate === 0 && !bridgeFee && !protocolFee) {
    return (
      <div className={cn("bg-[#F8FAFA] border border-[rgba(3,121,113,0.15)] p-4", className)}>
        <p className="text-xs font-medium text-[#6B8A8D] uppercase tracking-wider mb-2">
          Fee Breakdown
        </p>
        <p className="text-xs text-[#6B8A8D]">No additional fees</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-[#F8FAFA] border border-[rgba(3,121,113,0.15)] p-4 space-y-2", className)}>
      <p className="text-xs font-medium text-[#6B8A8D] uppercase tracking-wider">
        Fee Breakdown
      </p>

      {fees.map((fee) => (
        <div key={fee.label} className="flex items-center justify-between">
          <span className="text-xs text-[#6B8A8D]">{fee.label}</span>
          {fee.value !== null ? (
            <span className="text-xs text-[#023436] tabular-nums font-[family-name:var(--font-heading)]">
              {formatFeeUSDC(fee.value)} USDC
            </span>
          ) : (
            <span className="text-xs text-[#9CA3AF]">--</span>
          )}
        </div>
      ))}

      {/* Total */}
      <div className="border-t border-[rgba(3,121,113,0.15)] pt-2 flex items-center justify-between">
        <span className="text-xs font-medium text-[#023436]">Total Fees</span>
        <span className="text-xs font-semibold text-[#023436] tabular-nums font-[family-name:var(--font-heading)]">
          {formatFeeUSDC(totalFees)} USDC
        </span>
      </div>
    </div>
  );
}
