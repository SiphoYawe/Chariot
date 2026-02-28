"use client";

import { useMemo, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useVaultMetrics } from "@/hooks/useVaultMetrics";
import { RATE_MODEL } from "@chariot/shared";

function calculateBorrowRate(utilisationPercent: number): number {
  const fraction = utilisationPercent / 100;
  if (fraction <= RATE_MODEL.U_OPTIMAL) {
    return (RATE_MODEL.R_BASE + RATE_MODEL.R_SLOPE1 * (fraction / RATE_MODEL.U_OPTIMAL)) * 100;
  }
  return (
    (RATE_MODEL.R_BASE +
      RATE_MODEL.R_SLOPE1 +
      RATE_MODEL.R_SLOPE2 * ((fraction - RATE_MODEL.U_OPTIMAL) / (1 - RATE_MODEL.U_OPTIMAL))) *
    100
  );
}

function calculateSupplyAPY(utilisationPercent: number, borrowRate: number): number {
  const fraction = utilisationPercent / 100;
  const borrowFraction = borrowRate / 100;
  const borrowComponent = borrowFraction * fraction * (1 - RATE_MODEL.RESERVE_FACTOR);
  const tbillComponent =
    RATE_MODEL.USYC_YIELD * (1 - fraction) * (1 - RATE_MODEL.STRATEGY_FEE);
  return (borrowComponent + tbillComponent) * 100;
}

interface CurveTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: number;
}

function CurveTooltip({ active, payload, label }: CurveTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-3 shadow-sm">
      <p className="text-xs text-[#6B8A8D] mb-1.5 font-[family-name:var(--font-heading)]">
        {label}% Utilisation
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2 h-2 shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-[#6B8A8D]">{entry.name}</span>
          <span className="text-sm font-semibold tabular-nums font-[family-name:var(--font-heading)] text-[#023436] ml-auto">
            {entry.value.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function UtilisationCurveChart() {
  const { data, isLoading } = useVaultMetrics();
  const currentUtilisation = data?.utilisationRate ?? 0;

  const curveData = useMemo(() => {
    const points = [];
    for (let u = 0; u <= 100; u += 2) {
      const borrowRate = calculateBorrowRate(u);
      const supplyAPY = calculateSupplyAPY(u, borrowRate);
      points.push({ utilisation: u, borrowRate, supplyAPY });
    }
    return points;
  }, []);

  const { currentBorrowRate, currentSupplyAPY, snappedX } = useMemo(() => {
    const br = calculateBorrowRate(currentUtilisation);
    const sa = calculateSupplyAPY(currentUtilisation, br);
    const sx = Math.round(currentUtilisation / 2) * 2;
    return { currentBorrowRate: br, currentSupplyAPY: sa, snappedX: sx };
  }, [currentUtilisation]);

  const formatYTick = useCallback((v: number) => `${v.toFixed(0)}%`, []);
  const formatXTick = useCallback((v: number) => `${v}%`, []);

  if (isLoading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-48 mb-4" />
        <Skeleton className="h-[240px] w-full" />
      </div>
    );
  }

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Interest Rate Curve
        </h3>
        <div className="flex items-center gap-4 text-xs text-[#6B8A8D]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#DC2626]" />
            Borrow Rate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#10B981]" />
            Supply APY
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={curveData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(3,121,113,0.08)"
            vertical={false}
          />
          <XAxis
            dataKey="utilisation"
            tickFormatter={formatXTick}
            tick={{ fontSize: 10, fill: "#6B8A8D" }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Utilisation",
              position: "insideBottomRight",
              offset: -5,
              fill: "#6B8A8D",
              fontSize: 10,
            }}
          />
          <YAxis
            tickFormatter={formatYTick}
            tick={{ fontSize: 10, fill: "#6B8A8D" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CurveTooltip />} />
          <ReferenceLine
            x={RATE_MODEL.U_OPTIMAL * 100}
            stroke="rgba(3,121,113,0.3)"
            strokeDasharray="4 4"
            label={{
              value: "Kink (80%)",
              position: "top",
              fill: "#6B8A8D",
              fontSize: 10,
            }}
          />
          <Line
            type="monotone"
            dataKey="borrowRate"
            name="Borrow Rate"
            stroke="#DC2626"
            strokeWidth={2}
            dot={false}
            animationDuration={500}
          />
          <Line
            type="monotone"
            dataKey="supplyAPY"
            name="Supply APY"
            stroke="#10B981"
            strokeWidth={2}
            dot={false}
            animationDuration={500}
          />
          {/* Current utilisation markers -- all use same snapped X */}
          <ReferenceDot
            x={snappedX}
            y={currentBorrowRate}
            r={5}
            fill="#DC2626"
            stroke="white"
            strokeWidth={2}
          />
          <ReferenceDot
            x={snappedX}
            y={currentSupplyAPY}
            r={5}
            fill="#10B981"
            stroke="white"
            strokeWidth={2}
          />
          <ReferenceLine
            x={snappedX}
            stroke="#023436"
            strokeDasharray="2 2"
            strokeWidth={1}
            label={{
              value: `Current (${currentUtilisation.toFixed(1)}%)`,
              position: "top",
              fill: "#023436",
              fontSize: 10,
              fontWeight: 600,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
