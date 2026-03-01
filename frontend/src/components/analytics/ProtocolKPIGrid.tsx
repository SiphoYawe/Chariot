"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { KPICard } from "./KPICard";
import { useProtocolKPIs } from "@/hooks/useProtocolKPIs";

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function getTrend(history: number[]): "up" | "down" | "flat" {
  if (history.length < 2) return "flat";
  const recent = history[history.length - 1];
  const previous = history[history.length - 2];
  if (recent > previous) return "up";
  if (recent < previous) return "down";
  return "flat";
}

export function ProtocolKPIGrid() {
  const { data, isLoading, isError, refetch } = useProtocolKPIs();

  if (isError) {
    return <ErrorState message="Unable to load protocol KPIs." onRetry={refetch} />;
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border border-[rgba(3,121,113,0.15)] bg-white p-5">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        label="TVL"
        value={formatCompact(data.tvl)}
        sparkData={data.tvlHistory}
        sparkColor="#03B5AA"
        trend={getTrend(data.tvlHistory)}
      />
      <KPICard
        label="Total Borrowed"
        value={formatCompact(data.totalBorrowed)}
        sparkData={data.borrowedHistory}
        sparkColor="#F59E0B"
        trend={getTrend(data.borrowedHistory)}
      />
      <KPICard
        label="Active Positions"
        value={data.activePositions > 0 ? `${data.activePositions}+` : "0"}
        sparkData={data.positionsHistory}
        sparkColor="#037971"
        trend={getTrend(data.positionsHistory)}
      />
      <KPICard
        label="Protocol Revenue"
        value={formatCompact(data.revenue)}
        sparkData={data.revenueHistory}
        sparkColor="#10B981"
        trend={getTrend(data.revenueHistory)}
      />
    </div>
  );
}
