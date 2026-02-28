"use client";

import { useState } from "react";
import { useCircuitBreakerStatus } from "@/hooks/useCircuitBreakerStatus";
import { EducationTooltip } from "@/components/feedback/EducationTooltip";
import { Alert02Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CircuitBreakerLevel } from "@chariot/shared";

interface LevelConfig {
  title: string;
  description: string;
  iconColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

const LEVEL_CONFIG: Record<CircuitBreakerLevel, LevelConfig | null> = {
  0: null,
  1: {
    title: "Caution -- Borrowing Paused",
    description:
      "New borrowing is temporarily paused due to market conditions. Existing positions, repayments, and withdrawals continue normally.",
    iconColor: "#F59E0B",
    textColor: "#92400E",
    bgColor: "rgba(245, 158, 11, 0.08)",
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  2: {
    title: "Stress -- Withdrawals Rate-Limited",
    description:
      "Withdrawals are rate-limited to protect all depositors. You may withdraw up to 5% of pool per hour. Small balances (<1,000 USDC) can withdraw fully.",
    iconColor: "#F59E0B",
    textColor: "#92400E",
    bgColor: "rgba(245, 158, 11, 0.08)",
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  3: {
    title: "Emergency Mode Active",
    description:
      "Emergency mode active. Only repayments and liquidations are processing. Admin action required to resume normal operations.",
    iconColor: "#DC2626",
    textColor: "#991B1B",
    bgColor: "rgba(220, 38, 38, 0.08)",
    borderColor: "rgba(220, 38, 38, 0.25)",
  },
};

export function CircuitBreakerBanner() {
  const { level, isLoading } = useCircuitBreakerStatus();
  const [dismissed, setDismissed] = useState(false);
  const [prevLevel, setPrevLevel] = useState<CircuitBreakerLevel>(0);

  // Re-show banner when level changes (adjust state during render)
  if (level !== prevLevel) {
    setPrevLevel(level);
    setDismissed(false);
  }

  if (isLoading || level === 0 || dismissed) return null;

  const config = LEVEL_CONFIG[level];
  if (!config) return null;

  return (
    <div
      className="mb-6 p-4 flex items-start gap-3"
      style={{
        backgroundColor: config.bgColor,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: config.borderColor,
      }}
    >
      {/* Alert icon */}
      <HugeiconsIcon
        icon={Alert02Icon}
        size={20}
        className="shrink-0 mt-0.5"
        style={{ color: config.iconColor }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className="text-sm font-semibold font-[family-name:var(--font-heading)]"
            style={{ color: config.textColor }}
          >
            {config.title}
          </span>
          <EducationTooltip term="circuitBreaker" />
        </div>
        <p className="text-xs leading-relaxed" style={{ color: config.textColor }}>
          {config.description}
        </p>
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 hover:opacity-70 transition-opacity"
        aria-label="Dismiss alert"
      >
        <HugeiconsIcon
          icon={Cancel01Icon}
          size={16}
          style={{ color: config.textColor }}
        />
      </button>
    </div>
  );
}
