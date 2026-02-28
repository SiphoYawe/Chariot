"use client";

import { cn } from "@/lib/utils";

interface TrendIndicatorProps {
  /** Current value */
  value: number;
  /** Previous value to compare against */
  previousValue: number;
  /** Display format */
  format: "percent" | "usd";
  /** Optional className */
  className?: string;
}

function formatChange(value: number, format: "percent" | "usd"): string {
  if (format === "percent") {
    return `${Math.abs(value).toFixed(2)}%`;
  }
  return `$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function TrendIndicator({
  value,
  previousValue,
  format,
  className,
}: TrendIndicatorProps) {
  const change = value - previousValue;
  const percentChange =
    previousValue !== 0 ? ((value - previousValue) / previousValue) * 100 : 0;

  const isPositive = change > 0;
  const isNeutral = change === 0;

  const color = isNeutral
    ? "text-[#6B8A8D]"
    : isPositive
      ? "text-[#10B981]"
      : "text-[#F59E0B]";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium tabular-nums font-[family-name:var(--font-heading)] transition-colors duration-300",
        color,
        className
      )}
    >
      {/* Arrow */}
      {!isNeutral && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={cn(
            "transition-transform duration-300",
            !isPositive && "rotate-180"
          )}
        >
          <path
            d="M6 10V2M6 2L2 6M6 2L10 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
          />
        </svg>
      )}
      {isNeutral && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6H10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
          />
        </svg>
      )}

      {/* Percentage change */}
      <span>{isPositive ? "+" : isNeutral ? "" : "-"}{Math.abs(percentChange).toFixed(2)}%</span>

      {/* Dollar/value change */}
      <span className="text-[#6B8A8D]">
        ({isPositive ? "+" : isNeutral ? "" : "-"}{formatChange(change, format)})
      </span>
    </span>
  );
}
