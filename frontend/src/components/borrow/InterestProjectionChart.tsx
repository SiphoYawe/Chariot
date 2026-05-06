"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface InterestProjectionChartProps {
  outstandingDebt: number;
  borrowRate: number; // annual, 0-1
}

interface ProjectionTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: number;
}

function ProjectionTooltip({ active, payload, label }: ProjectionTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-3 shadow-sm">
      <p className="text-xs text-[#6B8A8D] mb-1 font-[family-name:var(--font-heading)]">Day {label}</p>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-[#DC2626] shrink-0" />
        <span className="text-xs text-[#6B8A8D]">Accrued interest</span>
        <span className="text-sm font-semibold tabular-nums text-[#023436] font-[family-name:var(--font-heading)] ml-auto">
          ${payload[0].value.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export function InterestProjectionChart({ outstandingDebt, borrowRate }: InterestProjectionChartProps) {
  const chartData = useMemo(() => {
    const dailyRate = borrowRate / 365;
    return Array.from({ length: 91 }, (_, i) => ({
      day: i,
      interest: outstandingDebt * dailyRate * i,
    }));
  }, [outstandingDebt, borrowRate]);

  const interest30 = outstandingDebt * (borrowRate / 365) * 30;
  const interest90 = outstandingDebt * (borrowRate / 365) * 90;

  if (outstandingDebt <= 0) return null;

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Interest Projection
        </h3>
        <span className="text-xs text-[#6B8A8D]">At current rate ({(borrowRate * 100).toFixed(2)}% APR)</span>
      </div>

      {/* Quick stats */}
      <div className="flex gap-4 mb-4">
        {[{ label: "30 days", value: interest30 }, { label: "90 days", value: interest90 }].map((s) => (
          <div key={s.label}>
            <p className="text-[10px] text-[#6B8A8D]">{s.label}</p>
            <p className="text-sm font-semibold tabular-nums text-[#DC2626] font-[family-name:var(--font-heading)]">
              +${s.value.toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="interestGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#DC2626" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#DC2626" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(3,121,113,0.08)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "#6B8A8D" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}d`}
          />
          <YAxis
            tickFormatter={(v) => `$${v.toFixed(1)}`}
            tick={{ fontSize: 10, fill: "#6B8A8D" }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<ProjectionTooltip />} />
          <ReferenceLine x={30} stroke="#6B8A8D" strokeDasharray="3 3" />
          <ReferenceLine x={60} stroke="#6B8A8D" strokeDasharray="3 3" />
          <Area
            type="linear"
            dataKey="interest"
            stroke="#DC2626"
            strokeWidth={2}
            fill="url(#interestGradient)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
