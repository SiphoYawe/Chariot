"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useVaultComposition } from "@/hooks/useVaultComposition";

const SEGMENTS = [
  { key: "idle", label: "Idle in Pool", color: "#037971" },
  { key: "lent", label: "Lent Out", color: "#F59E0B" },
  { key: "usyc", label: "T-Bills (USYC) -- Pending Whitelisting", color: "#10B981" },
] as const;

function formatUSDC(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface CompositionTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { percentage: string; color: string };
  }>;
}

function CompositionTooltip({ active, payload }: CompositionTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-2 h-2 shrink-0"
          style={{ backgroundColor: entry.payload.color }}
        />
        <span className="text-xs text-[#6B8A8D]">{entry.name}</span>
      </div>
      <p className="text-sm font-semibold tabular-nums font-[family-name:var(--font-heading)] text-[#023436]">
        {formatUSDC(entry.value)}
      </p>
      <p className="text-xs text-[#9CA3AF] mt-0.5">{entry.payload.percentage}</p>
    </div>
  );
}

export function VaultCompositionChart() {
  const { data, isLoading, isError, refetch } = useVaultComposition();

  if (isLoading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-40 mb-4" />
        <div className="flex items-center justify-center">
          <Skeleton className="h-[200px] w-[200px] rounded-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Unable to load vault composition." onRetry={refetch} />;
  }

  if (!data || data.total === 0) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
          Vault Composition
        </h3>
        <div className="h-[200px] flex items-center justify-center text-sm text-[#6B8A8D]">
          No vault data yet
        </div>
      </div>
    );
  }

  const chartData = SEGMENTS.map((seg) => ({
    name: seg.label,
    value: data[seg.key],
    color: seg.color,
    percentage: data.total > 0
      ? `${((data[seg.key] / data.total) * 100).toFixed(1)}%`
      : "0.0%",
  }));

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Vault Composition
        </h3>
        <span className="text-xs tabular-nums font-[family-name:var(--font-heading)] text-[#6B8A8D]">
          {formatUSDC(data.total)} Total
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div className="w-[200px] h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                dataKey="value"
                stroke="none"
                animationDuration={500}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CompositionTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3">
          {chartData.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2">
              <span
                className="w-3 h-3 shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <div>
                <p className="text-xs text-[#6B8A8D]">{entry.name}</p>
                <p className="text-sm font-semibold tabular-nums font-[family-name:var(--font-heading)] text-[#023436]">
                  {formatUSDC(entry.value)}{" "}
                  <span className="text-xs font-normal text-[#9CA3AF]">
                    ({entry.percentage})
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
