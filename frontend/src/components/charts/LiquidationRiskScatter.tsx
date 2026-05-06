"use client";

import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useBorrowerPositions } from "@/hooks/useBorrowerPositions";
import { RISK_PARAMS } from "@chariot/shared";

const LIQUIDATION_LTV = RISK_PARAMS.BRIDGED_ETH.LIQUIDATION_THRESHOLD * 100;

function getHealthColor(hf: number): string {
  if (!isFinite(hf) || hf > 1.5) return "#16A34A";
  if (hf >= 1.0) return "#D97706";
  return "#DC2626";
}

interface ScatterTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      address: string;
      ltv: number;
      collateralValueUSD: number;
      debtAmount: number;
      healthFactor: number;
    };
  }>;
}

function ScatterTooltip({ active, payload }: ScatterTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const hfDisplay = isFinite(d.healthFactor) ? d.healthFactor.toFixed(2) : "∞";
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-3 shadow-sm text-xs">
      <p className="text-[#6B8A8D] mb-1 font-mono">{d.address.slice(0, 10)}...{d.address.slice(-6)}</p>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-4">
          <span className="text-[#6B8A8D]">LTV</span>
          <span className="font-semibold text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">{d.ltv.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#6B8A8D]">Collateral</span>
          <span className="font-semibold text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">${d.collateralValueUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#6B8A8D]">Debt</span>
          <span className="font-semibold text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">${d.debtAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#6B8A8D]">Health</span>
          <span className="font-semibold tabular-nums font-[family-name:var(--font-heading)]" style={{ color: getHealthColor(d.healthFactor) }}>{hfDisplay}</span>
        </div>
      </div>
    </div>
  );
}

export function LiquidationRiskScatter() {
  const { positions, isLoading, isError, refetch } = useBorrowerPositions();

  const chartData = useMemo(
    () =>
      positions
        .filter((p) => p.debtAmount > 0 || p.collateralAmount > 0)
        .map((p) => ({
          address: p.address,
          ltv: p.collateralValueUSD > 0 ? (p.debtAmount / p.collateralValueUSD) * 100 : 0,
          collateralValueUSD: p.collateralValueUSD,
          debtAmount: p.debtAmount,
          healthFactor: p.healthFactor,
          z: Math.max(p.debtAmount, 100),
        })),
    [positions]
  );

  if (isLoading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-48 mb-4" />
        <Skeleton className="h-[280px] w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Unable to load borrower positions." onRetry={refetch} />;
  }

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Protocol Risk Map
        </h3>
        <span className="text-xs text-[#6B8A8D]">{chartData.length} active position{chartData.length !== 1 ? "s" : ""}</span>
      </div>
      <p className="text-xs text-[#6B8A8D] mb-4">X = LTV, Y = collateral value, size = debt, color = health factor</p>

      {chartData.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-sm text-[#6B8A8D]">
          No active positions to display
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(3,121,113,0.08)" />
            <XAxis
              type="number"
              dataKey="ltv"
              name="LTV"
              domain={[0, (dataMax: number) => Math.max(100, Math.ceil(dataMax * 1.05))] as [number, (dataMax: number) => number]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: "#6B8A8D" }}
              axisLine={false}
              tickLine={false}
              label={{ value: "Effective LTV (%)", position: "insideBottom", offset: -8, fontSize: 10, fill: "#6B8A8D" }}
            />
            <YAxis
              type="number"
              dataKey="collateralValueUSD"
              name="Collateral"
              tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}`}
              tick={{ fontSize: 10, fill: "#6B8A8D" }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <ZAxis type="number" dataKey="z" range={[40, 400]} />
            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3" }} />
            <ReferenceLine
              x={LIQUIDATION_LTV}
              stroke="#DC2626"
              strokeDasharray="4 4"
              label={{ value: `Liquidation (${LIQUIDATION_LTV}%)`, position: "top", fill: "#DC2626", fontSize: 10 }}
            />
            <Scatter
              data={chartData}
              shape={(props: { cx?: number; cy?: number; size?: number; payload?: { healthFactor: number } }) => {
                const { cx = 0, cy = 0, size = 100, payload } = props;
                const r = Math.max(4, Math.min(18, Math.sqrt(Math.max(size, 0) / 3.14159)));
                const color = getHealthColor(payload?.healthFactor ?? Infinity);
                return <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.8} stroke="#fff" strokeWidth={1.5} />;
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      <div className="flex gap-4 mt-3">
        {[{ label: "Safe (HF > 1.5)", color: "#16A34A" }, { label: "Caution (1.0--1.5)", color: "#D97706" }, { label: "At Risk (< 1.0)", color: "#DC2626" }].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
            <span className="text-[10px] text-[#6B8A8D]">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
