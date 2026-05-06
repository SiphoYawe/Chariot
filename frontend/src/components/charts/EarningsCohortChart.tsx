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

function isoWeek(utcMs: number): { year: number; week: number } {
  const d = new Date(utcMs);
  const day = d.getUTCDay() || 7; // Sun=0 -> 7 for ISO Monday-first weeks
  d.setUTCDate(d.getUTCDate() + 4 - day); // shift to Thursday of this ISO week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function bucketByWeek(data: { timestamp: number; earnings: number }[] | undefined): WeekBucket[] {
  if (!data || data.length === 0) return [];

  // Compute earnings deltas between consecutive data points
  const deltas: { timestamp: number; delta: number }[] = [];
  for (let i = 1; i < data.length; i++) {
    const delta = Math.max(0, data[i].earnings - data[i - 1].earnings);
    deltas.push({ timestamp: data[i].timestamp, delta });
  }

  // Group into ISO week buckets, keyed by "YYYY-Www" to avoid cross-year collision
  const map = new Map<string, { label: string; total: number }>();
  for (const d of deltas) {
    const { year, week } = isoWeek(d.timestamp);
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    const existing = map.get(key);
    if (existing) {
      existing.total += d.delta;
    } else {
      map.set(key, { label: `W${week}`, total: d.delta });
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, { label, total }]) => ({ week: label, earnings: total }));
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
