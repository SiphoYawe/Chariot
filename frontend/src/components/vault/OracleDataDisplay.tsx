"use client";

import { useOraclePrice } from "@/hooks/useOraclePrice";
import { useEffect, useState } from "react";

export function OracleDataDisplay() {
  const { data, isLoading, isError, refetch } = useOraclePrice();
  const [timeSince, setTimeSince] = useState<string>("--");
  const [stalenessColorClass, setStalenessColorClass] = useState<string>("text-[#9CA3AF]");

  useEffect(() => {
    if (!data) return;
    const update = () => {
      const seconds = Math.floor(Date.now() / 1000) - data.lastUpdated;
      if (seconds < 60) setTimeSince(`${seconds}s ago`);
      else if (seconds < 3600) setTimeSince(`${Math.floor(seconds / 60)}m ago`);
      else setTimeSince(`${Math.floor(seconds / 3600)}h ago`);

      if (seconds > 300) setStalenessColorClass("text-[#DC2626]");
      else if (seconds > 60) setStalenessColorClass("text-[#F59E0B]");
      else setStalenessColorClass("text-[#10B981]");
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [data]);

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <p className="text-sm text-[#6B8A8D] mb-1">ETH / USD</p>
        {isLoading ? (
          <div className="h-8 w-32 bg-[#F8FAFA] animate-pulse mt-1" />
        ) : isError ? (
          <div>
            <p className="text-sm text-[#DC2626]">Failed to load</p>
            <button onClick={refetch} className="text-xs text-[#03B5AA] mt-1">Retry</button>
          </div>
        ) : (
          <>
            <p className="text-2xl font-semibold font-[family-name:var(--font-heading)] tabular-nums mt-1">
              ${data!.ethPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className={`text-xs mt-1 ${stalenessColorClass}`}>Updated {timeSince}</p>
          </>
        )}
      </div>
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <p className="text-sm text-[#6B8A8D] mb-1">Volatility (EMA GK)</p>
        <p className="text-2xl font-semibold font-[family-name:var(--font-heading)] tabular-nums mt-1 text-[#9CA3AF]">--</p>
        <span className="text-xs bg-[#F8FAFA] border border-[rgba(3,121,113,0.15)] px-2 py-0.5 text-[#9CA3AF] inline-block mt-1">
          Phase 2
        </span>
      </div>
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <p className="text-sm text-[#6B8A8D] mb-1">Oracle Source</p>
        <p className="text-lg font-medium font-[family-name:var(--font-heading)] mt-1 text-[#023436]">Stork</p>
        <p className="text-xs text-[#9CA3AF] mt-1">Pull-based oracle on Arc</p>
      </div>
    </div>
  );
}
