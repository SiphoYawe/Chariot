"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useVaultMetrics } from "@/hooks/useVaultMetrics";

interface WaterfallTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { name: string; display: number; description: string } }>;
}

function WaterfallTooltip({ active, payload }: WaterfallTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-0.5">{d.name}</p>
      <p className="text-sm font-bold tabular-nums text-[#03B5AA] font-[family-name:var(--font-heading)]">{d.display.toFixed(2)}%</p>
      <p className="text-xs text-[#6B8A8D] mt-1">{d.description}</p>
    </div>
  );
}

export function APYWaterfallChart() {
  const { data, isLoading, isError, refetch } = useVaultMetrics();

  if (isLoading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-48 mb-4" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Unable to load APY data." onRetry={refetch} />;
  }

  const tbill = data?.tbillYieldComponent ?? 0;
  const borrow = data?.borrowInterestComponent ?? 0;
  const total = data?.supplyAPY ?? 0;

  if (!data || (tbill === 0 && borrow === 0 && total === 0)) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">APY Build-Up</h3>
        <div className="h-[200px] flex items-center justify-center text-sm text-[#6B8A8D]">No yield data available yet</div>
      </div>
    );
  }

  // Waterfall: invisible bottom bar lifts each segment to its correct position
  const chartData = [
    {
      name: "T-Bill Yield",
      invisible: 0,
      value: tbill,
      display: tbill,
      color: "#037971",
      description: "Yield from idle USDC in USYC T-Bill strategy (net of 5% fee)",
    },
    {
      name: "Borrow Interest",
      invisible: tbill,
      value: borrow,
      display: borrow,
      color: "#03B5AA",
      description: "Interest from USDC lent to borrowers (net of 10% reserve factor)",
    },
    {
      name: "Total APY",
      invisible: 0,
      value: total,
      display: total,
      color: "#023436",
      description: "Combined supply APY earned by lenders",
    },
  ];

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          APY Build-Up
        </h3>
        <span className="text-xs text-[#6B8A8D]">How supply yield is composed</span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(3,121,113,0.08)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#6B8A8D" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${v.toFixed(1)}%`}
            tick={{ fontSize: 10, fill: "#6B8A8D" }}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          <Tooltip content={<WaterfallTooltip />} cursor={{ fill: "rgba(3,121,113,0.04)" }} />
          {/* Invisible spacer bar */}
          <Bar dataKey="invisible" stackId="a" fill="transparent" />
          {/* Visible value bar */}
          <Bar dataKey="value" stackId="a" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
            <LabelList
              dataKey="display"
              position="top"
              formatter={(v: number) => `${v.toFixed(2)}%`}
              style={{ fontSize: 11, fill: "#023436", fontFamily: "var(--font-heading)", fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
