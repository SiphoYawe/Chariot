"use client";

import { useVaultMetrics } from "@/hooks/useVaultMetrics";
import { useRateBreakdown } from "@/hooks/useRateBreakdown";

function formatPercent(n: number): string {
  return (n * 100).toFixed(2) + "%";
}

export function BorrowRateDisplay() {
  const { data: vaultData, isLoading: vaultLoading, isError: vaultError, refetch } = useVaultMetrics();
  const { data: rateData, isLoading: rateLoading } = useRateBreakdown();

  const isLoading = vaultLoading || rateLoading;
  const totalRate = rateData ? rateData.totalRate : (vaultData ? vaultData.borrowRate / 100 : 0);

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <h3 className="text-sm font-medium text-[#6B8A8D] mb-4">ETH Borrow Rate</h3>
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-10 w-24 bg-[#F8FAFA] animate-pulse" />
          <div className="h-4 w-48 bg-[#F8FAFA] animate-pulse" />
        </div>
      ) : vaultError ? (
        <div>
          <p className="text-sm text-[#DC2626]">Failed to load rate data</p>
          <button onClick={() => refetch()} className="text-xs text-[#03B5AA] hover:text-[#037971] mt-1">
            Retry
          </button>
        </div>
      ) : (
        <>
          <p className="text-4xl font-bold font-[family-name:var(--font-heading)] tabular-nums text-[#023436]">
            {formatPercent(totalRate)}
          </p>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B8A8D]">Base Utilisation Rate</span>
              <span className="font-medium font-[family-name:var(--font-heading)] tabular-nums text-[#023436]">
                {rateData ? formatPercent(rateData.baseRate) : formatPercent(vaultData ? vaultData.borrowRate / 100 : 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className={rateData?.isPremiumActive ? "text-[#023436]" : "text-[#6B8A8D]"}>
                Volatility Premium
              </span>
              {rateData?.isPremiumActive ? (
                <span className="font-medium font-[family-name:var(--font-heading)] tabular-nums text-[#03B5AA]">
                  +{formatPercent(rateData.volatilityPremium)}
                </span>
              ) : (
                <span className="font-[family-name:var(--font-heading)] tabular-nums text-[#6B8A8D]">
                  {rateData ? "0.00% (within baseline)" : "0.00%"}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
