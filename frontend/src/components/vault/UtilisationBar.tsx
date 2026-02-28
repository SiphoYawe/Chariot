"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EducationTooltip } from "@/components/feedback/EducationTooltip";
import { useVaultMetrics } from "@/hooks/useVaultMetrics";
import { cn } from "@/lib/utils";

interface UtilisationBarProps {
  /** Optional className */
  className?: string;
}

function getSegmentColor(utilisation: number): string {
  if (utilisation < 50) return "#03B5AA"; // green/teal (low)
  if (utilisation < 80) return "#037971"; // teal (moderate)
  if (utilisation < 95) return "#F59E0B"; // amber (high)
  return "#DC2626"; // red (critical)
}

function getSegmentLabel(utilisation: number): string {
  if (utilisation < 50) return "Low";
  if (utilisation < 80) return "Moderate";
  if (utilisation < 95) return "High";
  return "Critical";
}

export function UtilisationBar({ className }: UtilisationBarProps) {
  const { data, isLoading, isError, refetch } = useVaultMetrics();

  if (isLoading) {
    return (
      <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Unable to load utilisation data." onRetry={refetch} />;
  }

  const utilisation = data?.utilisationRate ?? 0;
  const fillColor = getSegmentColor(utilisation);
  const label = getSegmentLabel(utilisation);

  return (
    <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-[#6B8A8D] font-[family-name:var(--font-body)]">
            Pool Utilisation
          </span>
          <EducationTooltip term="utilisation" />
        </div>
        <span
          className="text-xs font-medium px-2 py-0.5"
          style={{
            color: fillColor,
            backgroundColor: `${fillColor}15`,
          }}
        >
          {label}
        </span>
      </div>

      {/* Utilisation percentage */}
      <div className="flex items-baseline gap-1 mb-3">
        <span
          className="text-2xl font-bold font-[family-name:var(--font-heading)] tabular-nums"
          style={{ color: fillColor }}
        >
          {utilisation.toFixed(1)}%
        </span>
      </div>

      {/* Bar */}
      <div className="h-2 bg-[#F8FAFA] w-full mb-2">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${Math.min(utilisation, 100)}%`,
            backgroundColor: fillColor,
          }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between">
        <span className="text-[10px] text-[#6B8A8D]">0%</span>
        <span className="text-[10px] text-[#037971]">50%</span>
        <span className="text-[10px] text-[#F59E0B]">80%</span>
        <span className="text-[10px] text-[#DC2626]">95%</span>
        <span className="text-[10px] text-[#6B8A8D]">100%</span>
      </div>
    </div>
  );
}
