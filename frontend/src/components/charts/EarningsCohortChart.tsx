"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useYieldHistory } from "@/hooks/useYieldHistory";

interface WeekBucket {
  week: string;
  earnings: number;
}

function bucketByWeek(data: { timestamp: number; earnings: number }[]): WeekBucket[] {
  if (data.length === 0) return [];

  // Find earnings delta per data point
  const deltas: { timestamp: number; delta: number }[] = [];
  for (let i = 1; i < data.length; i++) {
    const delta = Math.max(0, data[i].earnings - data[i - 1].earnings);
    deltas.push({ timestamp: data[i].timestamp, delta });
  }

  // Group into ISO week buckets
  const map = new Map<string, number>();
  for (const d of deltas) {
    const date = new Date(d.timestamp);
    const year = date.getUTCFullYear();
    // ISO week number
    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil(((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
    const key = `W${week}`;
    map.set(key, (map.get(key) ?? 0) + d.delta);
  }

  return Array.from(map.entries()).map(([week, earnings]) => ({ week, earnings }));
}

interface EarningsTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function EarningsTooltip({ active, payload, label }: EarningsTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-3 shadow-sm">
      <p className="text-xs text-[#6B8A8D] mb-1 font-[family-name:var(--font-heading)]">{label}</p>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-[#03B5AA] shrink-0" />
        <span className="text-xs text-[#6B8A8D]">Earnings</span>
        <span className="text-sm font-semibold tabular-nums text-[#023436] font-[family-name:var(--font-heading)] ml-auto">
          ${payload[0].value.toFixed(4)}
        </span>
      </div>
    </div>
  );
}

export function EarningsCohortChart() {
  const { data: raw, isLoading } = useYieldHistory("all");
  const chartData = useMemo(() => bucketByWeek(raw), [raw]);

  if (isLoading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-44 mb-4" />
        <Skeleton className="h-[180px] w-full" />
      </div>
    );
  }

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Earnings by Week
        </h3>
        <span className="text-xs text-[#6B8A8D]">USDC earned per calendar week</span>
      </div>

      {chartData.length < 2 ? (
        <div className="h-[180px] flex flex-col items-center justify-center gap-1">
          <p className="text-sm text-[#6B8A8D]">Not enough earnings history yet</p>
          <p className="text-xs text-[#9CA3AF]">Chart populates after your first week of deposits</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#03B5AA" stopOpacity={1} />
                <stop offset="95%" stopColor="#037971" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(3,121,113,0.08)" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#6B8A8D" }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => `$${v.toFixed(3)}`}
              tick={{ fontSize: 10, fill: "#6B8A8D" }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip content={<EarningsTooltip />} cursor={{ fill: "rgba(3,121,113,0.04)" }} />
            <Bar dataKey="earnings" fill="url(#earningsGradient)" radius={[2, 2, 0, 0]} animationDuration={500} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
