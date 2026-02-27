"use client";

import { useCircuitBreakerStatus } from "@/hooks/useCircuitBreakerStatus";
import type { CircuitBreakerLevel } from "@chariot/shared";

const LEVEL_CONFIG: Record<CircuitBreakerLevel, { label: string; color: string; bg: string; border: string } | null> = {
  0: null, // Normal -- no banner
  1: { label: "Elevated Market Volatility -- New borrows paused", color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10", border: "border-[#F59E0B]/30" },
  2: { label: "High Market Stress -- Some operations may be limited", color: "text-[#F97316]", bg: "bg-[#F97316]/10", border: "border-[#F97316]/30" },
  3: { label: "Emergency Mode -- Operations paused", color: "text-[#DC2626]", bg: "bg-[#DC2626]/10", border: "border-[#DC2626]/30" },
};

export function CircuitBreakerBanner() {
  const { level, isLoading } = useCircuitBreakerStatus();

  if (isLoading || level === 0) return null;

  const config = LEVEL_CONFIG[level];
  if (!config) return null;

  return (
    <div className={`${config.bg} border ${config.border} p-4 mb-6 flex items-center gap-3`}>
      <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
    </div>
  );
}
