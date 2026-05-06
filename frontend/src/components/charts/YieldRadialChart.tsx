"use client";

import {
  RadialBarChart,
  RadialBar,
  Tooltip,
  ResponsiveContainer,
  PolarAngleAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useVaultMetrics } from "@/hooks/useVaultMetrics";

const MAX_APY = 15; // Scale: 15% = full circle

interface RadialTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
}

function RadialTooltip({ active, payload }: RadialTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-3 shadow-sm">
      <p className="text-xs text-[#6B8A8D]">{payload[0].name}</p>
      <p className="text-sm font-semibold tabular-nums text-[#023436] font-[family-name:var(--font-heading)]">
        {payload[0].value.toFixed(2)}%
      </p>
    </div>
  );
}

export function YieldRadialChart() {
  const { data, isLoading, isError, refetch } = useVaultMetrics();

  if (isLoading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-[220px] w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Unable to load yield data." onRetry={refetch} />;
  }

  const tbill = data?.tbillYieldComponent ?? 0;
  const borrow = data?.borrowInterestComponent ?? 0;
  const total = data?.supplyAPY ?? 0;

  const chartData = [
    { name: "Borrow Interest", value: borrow, fill: "#03B5AA" },
    { name: "T-Bill Yield", value: tbill, fill: "#037971" },
  ];

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Yield Attribution
        </h3>
        <span className="text-xs text-[#6B8A8D]">Components of supply APY</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="90%"
              startAngle={90}
              endAngle={-270}
              data={chartData}
            >
              <PolarAngleAxis type="number" domain={[0, MAX_APY]} tick={false} />
              <RadialBar
                background={{ fill: "#F8FAFA" }}
                dataKey="value"
              />
              <Tooltip content={<RadialTooltip />} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend + totals */}
        <div className="space-y-4 min-w-[140px]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 shrink-0" style={{ backgroundColor: "#037971" }} />
              <span className="text-xs text-[#6B8A8D]">T-Bill Yield</span>
            </div>
            <p className="text-xl font-bold tabular-nums text-[#023436] font-[family-name:var(--font-heading)] ml-5">
              {tbill.toFixed(2)}%
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 shrink-0" style={{ backgroundColor: "#03B5AA" }} />
              <span className="text-xs text-[#6B8A8D]">Borrow Interest</span>
            </div>
            <p className="text-xl font-bold tabular-nums text-[#023436] font-[family-name:var(--font-heading)] ml-5">
              {borrow.toFixed(2)}%
            </p>
          </div>
          <div className="pt-3 border-t border-[rgba(3,121,113,0.15)]">
            <p className="text-xs text-[#6B8A8D] mb-1">Total APY</p>
            <p className="text-2xl font-bold tabular-nums text-[#03B5AA] font-[family-name:var(--font-heading)]">
              {total.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
