"use client";

import { IconLockFilled, IconLockOpen } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface CollateralLockStatusProps {
  /** Whether user has active debt */
  hasDebt: boolean;
  /** Outstanding debt in USDC (when locked) */
  outstandingDebt: number;
  /** Optional className */
  className?: string;
}

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CollateralLockStatus({
  hasDebt,
  outstandingDebt,
  className,
}: CollateralLockStatusProps) {
  if (hasDebt) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 border border-[rgba(217,119,6,0.2)] bg-[rgba(217,119,6,0.04)] p-4",
          className
        )}
      >
        <IconLockFilled size={20} className="text-[#D97706] shrink-0" />
        <div>
          <span className="text-sm font-medium text-[#023436] font-[family-name:var(--font-heading)]">
            Locked
          </span>
          <p className="text-xs text-[#6B8A8D] mt-0.5">
            Repay ${formatUsd(outstandingDebt)} to unlock collateral
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 border border-[rgba(22,163,74,0.2)] bg-[rgba(22,163,74,0.04)] p-4",
        className
      )}
    >
      <IconLockOpen size={20} className="text-[#16A34A] shrink-0" />
      <div>
        <span className="text-sm font-medium text-[#023436] font-[family-name:var(--font-heading)]">
          Unlocked -- withdraw available
        </span>
        <p className="text-xs text-[#6B8A8D] mt-0.5">
          Your collateral is available for withdrawal
        </p>
      </div>
    </div>
  );
}
