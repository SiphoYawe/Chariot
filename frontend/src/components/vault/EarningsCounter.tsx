"use client";

import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useLenderPosition } from "@/hooks/useLenderPosition";
import { cn } from "@/lib/utils";

function formatUSDC(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
}

interface EarningsCounterProps {
  /** Optional className */
  className?: string;
}

/**
 * Animated earnings counter that ticks up in real-time at 60fps.
 * Uses requestAnimationFrame with direct DOM updates for performance.
 * Falls back to periodic static updates when prefers-reduced-motion is set.
 */
export function EarningsCounter({ className }: EarningsCounterProps) {
  const { data, isLoading, isError, refetch } = useLenderPosition();
  const valueElementRef = useRef<HTMLParagraphElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const baseValueRef = useRef<number>(0);

  const principal = data?.positionValue ?? 0;
  const apy = data?.personalAPY ?? 0;
  const earningsPerMs = (principal * (apy / 100)) / (365 * 24 * 3600 * 1000);

  // Direct DOM animation -- bypasses React render cycle for 60fps performance
  useEffect(() => {
    if (!data || earningsPerMs <= 0) return;

    // Check reduced motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      // Reduced motion: just show static value, refresh every 12s
      const interval = setInterval(() => refetch(), 12_000);
      return () => clearInterval(interval);
    }

    baseValueRef.current = data.accruedEarnings;
    lastTimestampRef.current = null;
    const rate = earningsPerMs;

    const tick = (timestamp: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;
      baseValueRef.current += rate * elapsed;

      // Direct DOM update -- no React re-render needed
      if (valueElementRef.current) {
        valueElementRef.current.textContent = `+$${formatUSDC(baseValueRef.current)}`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [data, earningsPerMs, refetch]);

  if (isLoading) {
    return (
      <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-10 w-48 mb-2" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Unable to load earnings data." onRetry={refetch} />;
  }

  if (!data) return null;

  return (
    <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
      <p className="text-xs font-medium text-[#6B8A8D] uppercase tracking-wider mb-3">
        Earnings
      </p>
      <p
        ref={valueElementRef}
        className="text-3xl font-bold font-[family-name:var(--font-heading)] tabular-nums text-[#10B981]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        +${formatUSDC(data.accruedEarnings)}
      </p>
      <p className="text-xs text-[#6B8A8D] mt-1.5 tabular-nums font-[family-name:var(--font-heading)]">
        {apy.toFixed(2)}% APY on ${principal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}
