"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { RISK_PARAMS } from "@chariot/shared";

interface LTVScenarioChartProps {
  collateralAmountEth: number;
  outstandingDebt: number;
  currentEthPrice: number;
}

const LIQUIDATION_LTV = RISK_PARAMS.BRIDGED_ETH.LIQUIDATION_THRESHOLD * 100;

function ltvColor(ltv: number): string {
  if (ltv >= LIQUIDATION_LTV) return "#DC2626";
  if (ltv >= 60) return "#D97706";
  return "#16A34A";
}

const SCENARIOS = [
  { label: "-50%", factor: 0.5 },
  { label: "-25%", factor: 0.75 },
  { label: "Current", factor: 1.0 },
  { label: "+25%", factor: 1.25 },
  { label: "+50%", factor: 1.5 },
];

interface ScenarioTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function ScenarioTooltip({ active, payload, label }: ScenarioTooltipProps) {
  if (!active || !payload?.length) return null;
  const ltv = payload[0].value;
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-3 shadow-sm">
      <p className="text-xs text-[#6B8A8D] mb-1 font-[family-name:var(--font-heading)]">ETH price {label}</p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#6B8A8D]">LTV</span>
        <span
          className="text-sm font-semibold tabular-nums font-[family-name:var(--font-heading)] ml-auto"
          style={{ color: ltvColor(ltv) }}
        >
          {ltv.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export function LTVScenarioChart({ collateralAmountEth, outstandingDebt, currentEthPrice }: LTVScenarioChartProps) {
  const chartData = useMemo(() => {
    return SCENARIOS.map((s) => {
      const scenarioPrice = currentEthPrice * s.factor;
      const collateralValue = collateralAmountEth * scenarioPrice;
      const ltv = collateralValue > 0 ? (outstandingDebt / collateralValue) * 100 : 0;
      return { label: s.label, ltv: Math.min(ltv, 100), scenarioPrice };
    });
  }, [collateralAmountEth, outstandingDebt, currentEthPrice]);

  if (outstandingDebt <= 0) return null;

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          LTV Price Scenarios
        </h3>
        <span className="text-xs text-[#6B8A8D]">How your LTV changes with ETH price</span>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(3,121,113,0.08)" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 10, fill: "#6B8A8D" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 11, fill: "#6B8A8D" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<ScenarioTooltip />} cursor={{ fill: "rgba(3,121,113,0.04)" }} />
          <ReferenceLine
            x={LIQUIDATION_LTV}
            stroke="#DC2626"
            strokeDasharray="4 4"
            label={{ value: `Liq. ${LIQUIDATION_LTV}%`, position: "insideTopRight", fill: "#DC2626", fontSize: 10 }}
          />
          <Bar dataKey="ltv" radius={[0, 2, 2, 0]}>
            {chartData.map((entry) => (
              <Cell
                key={entry.label}
                fill={ltvColor(entry.ltv)}
                fillOpacity={entry.label === "Current" ? 1 : 0.65}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
