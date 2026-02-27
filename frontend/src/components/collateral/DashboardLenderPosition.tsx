"use client";

import Link from "next/link";
import { PositionCard } from "./PositionCard";
import { useLenderPosition } from "@/hooks/useLenderPosition";

export function DashboardLenderPosition() {
  const { data, isLoading, hasPosition } = useLenderPosition();

  // Don't render anything on dashboard if user has no position
  if (!isLoading && !hasPosition) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] text-[#023436]">
          Your Lending Position
        </h2>
        <Link
          href="/lend"
          className="text-sm text-[#03B5AA] hover:text-[#037971] font-medium"
        >
          View Details
        </Link>
      </div>
      <PositionCard
        shareBalance={data?.shareBalance ?? 0}
        sharePrice={data?.sharePrice ?? 0}
        positionValue={data?.positionValue ?? 0}
        originalDeposit={data?.originalDeposit ?? 0}
        accruedEarnings={data?.accruedEarnings ?? 0}
        personalAPY={data?.personalAPY ?? 0}
        loading={isLoading}
        compact
      />
    </div>
  );
}
