"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { SparkChart } from "@/components/charts/SparkChart";

interface KPICardProps {
  label: string;
  value: string;
  sparkData?: number[];
  sparkColor?: string;
  loading?: boolean;
  trend?: "up" | "down" | "flat";
}

export function KPICard({
  label,
  value,
  sparkData,
  sparkColor = "#03B5AA",
  loading,
  trend,
}: KPICardProps) {
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-5">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-[#6B8A8D] uppercase tracking-wider">
          {label}
        </p>
        {sparkData && sparkData.length >= 2 && !loading && (
          <SparkChart data={sparkData} color={sparkColor} width={64} height={20} />
        )}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-28" />
      ) : (
        <div className="flex items-baseline gap-2">
          <p className="text-xl font-bold tabular-nums font-[family-name:var(--font-heading)] text-[#023436]">
            {value}
          </p>
          {trend && trend !== "flat" && (
            <span
              className={`text-xs font-medium ${
                trend === "up" ? "text-[#10B981]" : "text-[#DC2626]"
              }`}
            >
              {trend === "up" ? "\u2191" : "\u2193"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
