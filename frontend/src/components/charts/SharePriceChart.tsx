"use client";

import { useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ChartTooltip } from "./ChartTooltip";
import { useSharePriceHistory } from "@/hooks/useSharePriceHistory";

const BASELINE_PRICE = 1.0;

function formatSharePrice(value: number): string {
  return `$${value.toFixed(6)}`;
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

function domainMin(dataMin: number): number {
  return dataMin - 0.00001;
}

function domainMax(dataMax: number): number {
  return dataMax + 0.00001;
}

export function SharePriceChart() {
  const { data, isLoading, isError, refetch } = useSharePriceHistory("all");

  const formatXTick = useCallback(
    (v: number) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    []
  );

  const formatYTick = useCallback((v: number) => v.toFixed(4), []);

  if (isLoading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-48 mb-4" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Unable to load share price history." onRetry={refetch} />;
  }

  const chartData = data.map((d) => ({
    timestamp: d.timestamp,
    price: d.price,
  }));

  const lastPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : BASELINE_PRICE;
  const lineColor = lastPrice >= BASELINE_PRICE ? "#10B981" : "#6B8A8D";

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          chUSDC Share Price
        </h3>
        <span className="text-xs tabular-nums font-[family-name:var(--font-heading)] text-[#6B8A8D]">
          Since Inception
        </span>
      </div>

      {chartData.length < 2 ? (
        <div className="h-[200px] flex flex-col items-center justify-center gap-1">
          <p className="text-sm text-[#6B8A8D]">Collecting price data</p>
          <p className="text-xs text-[#9CA3AF]">Chart will appear as on-chain snapshots accumulate</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
              domain={[domainMin, domainMax]}
              tickFormatter={formatYTick}
              tick={{ fontSize: 10, fill: "#6B8A8D" }}
              axisLine={false}
              tickLine={false}
              width={55}
            />
            <Tooltip
              content={
                <ChartTooltip
                  formatValue={formatSharePrice}
                  formatLabel={formatTimestampLabel}
                />
              }
            />
            <ReferenceLine
              y={BASELINE_PRICE}
              stroke="rgba(3,121,113,0.2)"
              strokeDasharray="4 4"
              label={{
                value: "Inception",
                position: "insideTopRight",
                fill: "#6B8A8D",
                fontSize: 10,
              }}
            />
            <Line
              type="monotone"
              dataKey="price"
              name="Share Price"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              animationDuration={500}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
