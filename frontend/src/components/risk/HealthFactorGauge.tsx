"use client";

import { cn } from "@/lib/utils";

interface HealthFactorGaugeProps {
  /** Health factor value (1.0 = liquidation threshold). Infinity for no debt. */
  healthFactor: number;
  /** Whether the user has active debt */
  hasDebt: boolean;
  /** Optional className */
  className?: string;
}

function getRiskConfig(hf: number, hasDebt: boolean) {
  if (!hasDebt) {
    return {
      color: "#6B8A8D",
      bgColor: "rgba(107, 138, 141, 0.1)",
      barWidth: "100%",
      label: "No Debt",
      display: "\u221E",
    };
  }
  if (hf > 1.5) {
    return {
      color: "#16A34A",
      bgColor: "rgba(22, 163, 74, 0.1)",
      barWidth: "100%",
      label: "Safe",
      display: hf.toFixed(2),
    };
  }
  if (hf >= 1.0) {
    return {
      color: "#D97706",
      bgColor: "rgba(217, 119, 6, 0.1)",
      barWidth: `${Math.max(20, ((hf - 0.5) / 1.5) * 100)}%`,
      label: "Caution",
      display: hf.toFixed(2),
    };
  }
  return {
    color: "#DC2626",
    bgColor: "rgba(220, 38, 38, 0.1)",
    barWidth: `${Math.max(10, (hf / 1.5) * 100)}%`,
    label: "At Risk",
    display: hf.toFixed(2),
  };
}

export function HealthFactorGauge({
  healthFactor,
  hasDebt,
  className,
}: HealthFactorGaugeProps) {
  const config = getRiskConfig(healthFactor, hasDebt);

  return (
    <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-[#6B8A8D] font-[family-name:var(--font-body)]">
          Health Factor
        </span>
        <span
          className="text-xs font-medium px-2 py-0.5"
          style={{ color: config.color, backgroundColor: config.bgColor }}
        >
          {config.label}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span
          className="text-3xl font-bold font-[family-name:var(--font-heading)] tabular-nums"
          style={{ color: config.color }}
        >
          {config.display}
        </span>
      </div>

      {/* Gauge bar */}
      <div className="h-1.5 bg-[#F8FAFA] w-full">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: config.barWidth,
            backgroundColor: config.color,
          }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-[#6B8A8D]">0</span>
        <span className="text-[10px] text-[#DC2626]">1.0</span>
        <span className="text-[10px] text-[#D97706]">1.5</span>
        <span className="text-[10px] text-[#16A34A]">2.0+</span>
      </div>
    </div>
  );
}
