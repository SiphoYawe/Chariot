"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { Transaction } from "@/types/transaction";

interface PLWaterfallChartProps {
  transactions: Transaction[];
}

interface WaterfallBar {
  label: string;
  value: number;
  invisible: number;
  isTotal: boolean;
  color: string;
}

function buildWaterfallData(transactions: Transaction[]): WaterfallBar[] {
  let deposits = 0, withdrawals = 0, borrows = 0, repays = 0;

  for (const tx of transactions) {
    switch (tx.type) {
      case "deposit": deposits += tx.amount; break;
      case "withdrawal": withdrawals += tx.amount; break;
      case "borrow": borrows += tx.amount; break;
      case "repay": repays += tx.amount; break;
    }
  }

  const netLending = withdrawals - deposits;
  const netBorrowing = borrows - repays;
  const total = netLending + netBorrowing;

  const bars: WaterfallBar[] = [];
  let runningBase = 0;

  const addBar = (label: string, value: number, isTotal = false) => {
    if (value === 0) return;
    const isPositive = value >= 0;
    bars.push({
      label,
      value: Math.abs(value),
      invisible: isTotal ? 0 : isPositive ? runningBase : runningBase - Math.abs(value),
      isTotal,
      color: isTotal ? (total >= 0 ? "#16A34A" : "#DC2626") : isPositive ? "#03B5AA" : "#DC2626",
    });
    if (!isTotal) runningBase += value;
  };

  addBar("Deposited", -deposits);
  addBar("Withdrawn", withdrawals);
  addBar("Borrowed", borrows);
  addBar("Repaid", -repays);
  addBar("Net P&L", total, true);

  return bars;
}

interface PLTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: WaterfallBar }>;
}

function PLTooltip({ active, payload }: PLTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-0.5">{d.label}</p>
      <p className="text-sm font-bold tabular-nums font-[family-name:var(--font-heading)]" style={{ color: d.color }}>
        ${d.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

export function PLWaterfallChart({ transactions }: PLWaterfallChartProps) {
  const chartData = useMemo(() => buildWaterfallData(transactions), [transactions]);

  if (transactions.length === 0 || chartData.length === 0) return null;

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Activity Breakdown
        </h3>
        <span className="text-xs text-[#6B8A8D]">Cumulative USDC flows</span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(3,121,113,0.08)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B8A8D" }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            tick={{ fontSize: 10, fill: "#6B8A8D" }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<PLTooltip />} cursor={{ fill: "rgba(3,121,113,0.04)" }} />
          <ReferenceLine y={0} stroke="rgba(3,121,113,0.2)" />
          <Bar dataKey="invisible" stackId="a" fill="transparent" />
          <Bar dataKey="value" stackId="a" radius={[2, 2, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.label} fill={entry.color} fillOpacity={entry.isTotal ? 1 : 0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
