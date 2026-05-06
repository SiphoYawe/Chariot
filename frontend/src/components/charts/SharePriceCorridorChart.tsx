"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useSharePriceHistory } from "@/hooks/useSharePriceHistory";
import type { TimePeriod } from "@/types/charts";

const PERIODS: { label: string; value: TimePeriod }[] = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "All", value: "all" },
];

const WINDOW = 20; // rolling window size for std dev band

function computeCorridorData(prices: { timestamp: number; price: number }[]) {
  return prices.map((pt, i) => {
    const window = prices.slice(Math.max(0, i - WINDOW), i + 1).map((p) => p.price);
    const mean = window.reduce((s, v) => s + v, 0) / window.length;
    const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / window.length;
    const std = Math.sqrt(variance);
    return {
      timestamp: pt.timestamp,
      price: pt.price,
      upper: mean + std,
      lower: Math.max(1, mean - std),
    };
  });
}

interface CorridorTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: number;
}

function CorridorTooltip({ active, payload, label }: CorridorTooltipProps) {
  if (!active || !payload?.length) return null;
  const priceEntry = payload.find((p) => p.dataKey === "price");
  const price = priceEntry?.value ?? 0;
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-3 shadow-sm">
      <p className="text-xs text-[#6B8A8D] mb-1.5 font-[family-name:var(--font-heading)]">
        {label ? new Date(label).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
      </p>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 shrink-0 bg-[#03B5AA]" />
        <span className="text-xs text-[#6B8A8D]">Share price</span>
        <span className="text-sm font-semibold tabular-nums text-[#023436] font-[family-name:var(--font-heading)] ml-auto">
          ${price.toFixed(6)}
        </span>
      </div>
    </div>
  );
}

export function SharePriceCorridorChart() {
  const [period, setPeriod] = useState<TimePeriod>("all");
  const { data: raw, isLoading } = useSharePriceHistory(period);

  const chartData = useMemo(() => computeCorridorData(raw), [raw]);

  const formatXTick = useCallback((v: number) => {
    return new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, []);

  const yMin = chartData.length ? Math.min(...chartData.map((d) => d.lower)) * 0.9999 : 0.9995;
  const yMax = chartData.length ? Math.max(...chartData.map((d) => d.upper)) * 1.0001 : 1.0010;

  if (isLoading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-44 mb-4" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
            chUSDC Share Price
          </h3>
          <p className="text-xs text-[#6B8A8D] mt-0.5">With +-1 std deviation corridor</p>
        </div>
        <div className="flex gap-1" role="tablist">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              role="tab"
              aria-selected={period === p.value}
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

      {chartData.length < 2 ? (
        <div className="h-[200px] flex flex-col items-center justify-center gap-1">
          <p className="text-sm text-[#6B8A8D]">Collecting share price data</p>
          <p className="text-xs text-[#9CA3AF]">Chart will appear as snapshots accumulate</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="corridorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#03B5AA" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#03B5AA" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(3,121,113,0.08)" vertical={false} />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={["dataMin", "dataMax"]}
              scale={"time" as const}
              tickFormatter={formatXTick}
              tick={{ fontSize: 10, fill: "#6B8A8D" }}
              axisLine={false}
              tickLine={false}
              minTickGap={50}
            />
            <YAxis
              domain={[yMin, yMax]}
              tickFormatter={(v) => `$${v.toFixed(4)}`}
              tick={{ fontSize: 10, fill: "#6B8A8D" }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip content={<CorridorTooltip />} />
            <ReferenceLine y={1.0} stroke="#9CA3AF" strokeDasharray="4 4" label={{ value: "$1.00", position: "insideTopRight", fontSize: 10, fill: "#9CA3AF" }} />
            {/* Corridor band */}
            <Area type="monotone" dataKey="upper" stroke="none" fill="url(#corridorGradient)" />
            <Area type="monotone" dataKey="lower" stroke="none" fill="#fff" />
            {/* Price line */}
            <Line type="monotone" dataKey="price" stroke="#03B5AA" strokeWidth={2} dot={false} animationDuration={500} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
