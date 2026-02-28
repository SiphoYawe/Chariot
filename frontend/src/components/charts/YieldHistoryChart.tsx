"use client";

import { useState, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ChartTooltip } from "./ChartTooltip";
import { useYieldHistory } from "@/hooks/useYieldHistory";
import type { TimePeriod } from "@/types/charts";

const PERIODS: { label: string; value: TimePeriod }[] = [
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "All", value: "all" },
];

function formatUSDC(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTimestampLabel(label: string | number): string {
  if (typeof label === "number") {
    return new Date(label).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return String(label);
}

export function YieldHistoryChart() {
  const [period, setPeriod] = useState<TimePeriod>("7d");
  const { data, isLoading, isError, refetch } = useYieldHistory(period);

  const formatXTick = useCallback(
    (v: number) => {
      const date = new Date(v);
      if (period === "24h") {
        return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      }
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    },
    [period]
  );

  const formatYTick = useCallback(
    (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v.toFixed(0)}`),
    []
  );

  if (isLoading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Unable to load yield history." onRetry={refetch} />;
  }

  const chartData = data.map((d) => ({
    timestamp: d.timestamp,
    earnings: d.earnings,
  }));

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Yield History
        </h3>
        <div className="flex gap-1" role="tablist" aria-label="Time period">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              role="tab"
              aria-selected={period === p.value}
              aria-label={`Show ${p.label} data`}
              onClick={() => setPeriod(p.value)}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                period === p.value
                  ? "bg-[#023436] text-white"
                  : "text-[#6B8A8D] hover:text-[#023436] hover:bg-[#F8FAFA]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-[#6B8A8D]">
          No yield data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#03B5AA" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#03B5AA" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(3,121,113,0.08)"
              vertical={false}
            />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXTick}
              tick={{ fontSize: 10, fill: "#6B8A8D" }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              tickFormatter={formatYTick}
              tick={{ fontSize: 10, fill: "#6B8A8D" }}
              axisLine={false}
              tickLine={false}
              width={45}
            />
            <Tooltip
              content={
                <ChartTooltip
                  formatValue={formatUSDC}
                  formatLabel={formatTimestampLabel}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="earnings"
              name="Earnings"
              stroke="#03B5AA"
              strokeWidth={2}
              fill="url(#yieldGradient)"
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
