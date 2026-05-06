"use client";

import { cn } from "@/lib/utils";

interface LiquidationThermometerProps {
  currentPrice: number;
  liquidationPrice: number;
  hasDebt: boolean;
  className?: string;
}

function formatUsd(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function LiquidationThermometer({ currentPrice, liquidationPrice, hasDebt, className }: LiquidationThermometerProps) {
  if (!hasDebt || liquidationPrice <= 0) {
    return (
      <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-2">
          Liquidation Buffer
        </h3>
        <p className="text-sm text-[#6B8A8D]">No active debt -- no liquidation risk.</p>
      </div>
    );
  }

  const scaleMax = currentPrice * 1.4;
  const scaleMin = Math.min(liquidationPrice * 0.7, currentPrice * 0.3);
  const range = scaleMax - scaleMin;

  const liquidationPct = ((liquidationPrice - scaleMin) / range) * 100;
  const currentPct = ((currentPrice - scaleMin) / range) * 100;
  const bufferPct = Math.max(0, currentPct - liquidationPct);
  const dropNeeded = ((currentPrice - liquidationPrice) / currentPrice) * 100;

  const isCritical = dropNeeded < 10;
  const isWarning = dropNeeded < 25;

  return (
    <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Liquidation Buffer
        </h3>
        <span
          className="text-xs font-medium px-2 py-0.5"
          style={{
            color: isCritical ? "#DC2626" : isWarning ? "#D97706" : "#16A34A",
            backgroundColor: isCritical ? "rgba(220,38,38,0.1)" : isWarning ? "rgba(217,119,6,0.1)" : "rgba(22,163,74,0.1)",
          }}
        >
          {dropNeeded.toFixed(1)}% buffer
        </span>
      </div>

      {/* Horizontal thermometer bar */}
      <div className="relative h-8 mb-6">
        {/* Background track */}
        <div className="absolute inset-0 bg-[#F8FAFA] border border-[rgba(3,121,113,0.15)]" />

        {/* Red danger zone (below liquidation) */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-[#DC2626] opacity-20"
          style={{ width: `${liquidationPct}%` }}
        />

        {/* Green safe zone (above liquidation up to current) */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: `${liquidationPct}%`,
            width: `${bufferPct}%`,
            backgroundColor: isCritical ? "#D97706" : "#16A34A",
            opacity: 0.3,
          }}
        />

        {/* Liquidation price marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-[#DC2626]"
          style={{ left: `${liquidationPct}%` }}
        />

        {/* Current price marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5"
          style={{ left: `${Math.min(currentPct, 98)}%`, backgroundColor: "#03B5AA" }}
        />
      </div>

      {/* Labels */}
      <div className="relative h-6 mb-4">
        <div
          className="absolute transform -translate-x-1/2 text-center"
          style={{ left: `${liquidationPct}%` }}
        >
          <div className="text-[9px] text-[#DC2626] font-medium whitespace-nowrap">Liquidation</div>
          <div className="text-[9px] text-[#DC2626] tabular-nums font-[family-name:var(--font-heading)]">${formatUsd(liquidationPrice)}</div>
        </div>
        <div
          className="absolute transform -translate-x-1/2 text-center"
          style={{ left: `${Math.min(currentPct, 95)}%` }}
        >
          <div className="text-[9px] text-[#03B5AA] font-medium whitespace-nowrap">Current</div>
          <div className="text-[9px] text-[#03B5AA] tabular-nums font-[family-name:var(--font-heading)]">${formatUsd(currentPrice)}</div>
        </div>
      </div>

      <p className="text-xs text-[#6B8A8D]">
        ETH must drop <span className="font-semibold tabular-nums text-[#023436] font-[family-name:var(--font-heading)]">{dropNeeded.toFixed(1)}%</span> to trigger liquidation
      </p>
    </div>
  );
}
