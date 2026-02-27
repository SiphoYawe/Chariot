"use client";

import { useVaultMetrics } from "@/hooks/useVaultMetrics";

export function YieldDisplay() {
  const { data, isLoading, isError, refetch } = useVaultMetrics();

  // Supply APY formula:
  // (borrow_rate x utilisation x (1 - reserve_factor)) + (USYC_yield x (1 - utilisation) x (1 - strategy_fee))
  const supplyAPY = data ? data.supplyAPY : 0;
  const tbillComponent = data ? data.tbillYieldComponent : 0;
  const borrowComponent = data ? data.borrowInterestComponent : 0;

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <h3 className="text-sm font-medium text-[#6B8A8D] mb-4">Supply APY</h3>
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-10 w-24 bg-[#F8FAFA] animate-pulse" />
          <div className="h-4 w-48 bg-[#F8FAFA] animate-pulse" />
        </div>
      ) : isError ? (
        <div>
          <p className="text-sm text-[#DC2626]">Failed to load yield data</p>
          <button onClick={() => refetch()} className="text-xs text-[#03B5AA] hover:text-[#037971] mt-1">
            Retry
          </button>
        </div>
      ) : (
        <>
          <p className="text-4xl font-bold font-[family-name:var(--font-heading)] tabular-nums text-[#03B5AA]">
            {supplyAPY.toFixed(2)}%
          </p>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B8A8D]">T-Bill Yield</span>
              <span className="font-medium font-[family-name:var(--font-heading)] tabular-nums text-[#023436]">
                {tbillComponent.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B8A8D]">Borrower Interest</span>
              <span className="font-medium font-[family-name:var(--font-heading)] tabular-nums text-[#023436]">
                {borrowComponent.toFixed(2)}%
              </span>
            </div>
            <div className="border-t border-[rgba(3,121,113,0.15)] pt-2 flex items-center justify-between text-sm">
              <span className="font-medium text-[#023436]">Combined</span>
              <span className="font-semibold font-[family-name:var(--font-heading)] tabular-nums text-[#03B5AA]">
                {supplyAPY.toFixed(2)}%
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
