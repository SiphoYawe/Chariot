"use client";

import { useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useUtilisationHistory } from "@/hooks/useUtilisationHistory";
import type { TimePeriod } from "@/types/charts";

const PERIODS: { label: string; value: TimePeriod }[] = [
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "All", value: "all" },
];

const OPTIMAL_UTILISATION = 80;

function formatUtilisation(value: number): string {
  return `${value.toFixed(1)}%`;
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

function getBarColor(utilisation: number): string {
  if (utilisation < 50) return "#10B981"; // green
  if (utilisation < 80) return "#03B5AA"; // teal
  if (utilisation < 95) return "#F59E0B"; // amber
  return "#DC2626"; // red
}

interface UtilisationTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { timestamp: number; utilisation: number };
  }>;
}

function UtilisationTooltip({ active, payload }: UtilisationTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const util = entry.payload.utilisation;
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-3 shadow-sm">
      <p className="text-xs text-[#6B8A8D] mb-1.5 font-[family-name:var(--font-heading)]">
        {formatTimestampLabel(entry.payload.timestamp)}
      </p>
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 shrink-0"
          style={{ backgroundColor: getBarColor(util) }}
        />
        <span className="text-xs text-[#6B8A8D]">Utilisation</span>
        <span className="text-sm font-semibold tabular-nums font-[family-name:var(--font-heading)] text-[#023436] ml-auto">
          {formatUtilisation(util)}
        </span>
      </div>
    </div>
  );
}

// Custom bar shape with dynamic color
interface BarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  utilisation?: number;
}

function ColoredBar({ x = 0, y = 0, width = 0, height = 0, utilisation = 0 }: BarShapeProps) {
  return <rect x={x} y={y} width={width} height={height} fill={getBarColor(utilisation)} />;
}

export function UtilisationHistoryChart() {
  const [period, setPeriod] = useState<TimePeriod>("7d");
  const { data, isLoading, isError, refetch } = useUtilisationHistory(period);

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

  if (isLoading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Unable to load utilisation history." onRetry={refetch} />;
  }

  const chartData = data.map((d) => ({
    timestamp: d.timestamp,
    utilisation: d.utilisation,
  }));

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Utilisation History
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

      {chartData.length < 2 ? (
        <div className="h-[200px] flex flex-col items-center justify-center gap-1">
          <p className="text-sm text-[#6B8A8D]">Collecting utilisation data</p>
          <p className="text-xs text-[#9CA3AF]">Chart will appear as on-chain snapshots accumulate</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: "#6B8A8D" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<UtilisationTooltip />} />
            <ReferenceLine
              y={OPTIMAL_UTILISATION}
              stroke="#037971"
              strokeDasharray="4 4"
              label={{
                value: "Optimal (80%)",
                position: "insideTopRight",
                fill: "#037971",
                fontSize: 10,
              }}
            />
            <Bar
              dataKey="utilisation"
              name="Utilisation"
              shape={<ColoredBar />}
              animationDuration={500}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
