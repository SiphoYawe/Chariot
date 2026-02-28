"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { SparkChart } from "@/components/charts/SparkChart";

interface DataCardProps {
  label: string;
  value: string;
  unit?: string;
  subtitle?: string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  accent?: boolean;
  sparkData?: number[];
  sparkColor?: string;
}

export function DataCard({ label, value, unit, subtitle, loading, error, onRetry, accent, sparkData, sparkColor }: DataCardProps) {
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-start justify-between">
        <p className="text-sm text-[#6B8A8D] mb-1">{label}</p>
        {sparkData && sparkData.length >= 2 && !loading && !error && (
          <SparkChart data={sparkData} color={sparkColor} />
        )}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-32 mt-1" />
      ) : error ? (
        <div className="mt-1">
          <p className="text-sm text-[#DC2626]">Failed to load</p>
          {onRetry && (
            <button onClick={onRetry} className="text-xs text-[#03B5AA] hover:text-[#037971] mt-1">
              Retry
            </button>
          )}
        </div>
      ) : (
        <>
          <p className={`text-2xl font-semibold font-[family-name:var(--font-heading)] tabular-nums mt-1 ${accent ? "text-[#03B5AA]" : "text-[#023436]"}`}>
            {value}
            {unit && <span className="text-sm font-normal text-[#6B8A8D] ml-1">{unit}</span>}
          </p>
          {subtitle && <p className="text-xs text-[#9CA3AF] mt-1">{subtitle}</p>}
        </>
      )}
    </div>
  );
}
