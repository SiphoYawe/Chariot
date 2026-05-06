"use client";

import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useVaultComposition } from "@/hooks/useVaultComposition";

const COLORS: Record<string, string> = {
  "Idle in Pool": "#037971",
  "Lent Out": "#F59E0B",
  "T-Bills (USYC)": "#10B981",
};

function formatUSDC(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface TreemapTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number; pct: string } }>;
}

function TreemapTooltip({ active, payload }: TreemapTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2" style={{ backgroundColor: COLORS[d.name] }} />
        <span className="text-xs text-[#6B8A8D]">{d.name}</span>
      </div>
      <p className="text-sm font-semibold tabular-nums text-[#023436] font-[family-name:var(--font-heading)]">
        {formatUSDC(d.value)}
      </p>
      <p className="text-xs text-[#9CA3AF]">{d.pct}</p>
    </div>
  );
}

interface CustomContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  value?: number;
  pct?: string;
}

function CustomContent({ x = 0, y = 0, width = 0, height = 0, name = "", value = 0, pct = "" }: CustomContentProps) {
  const color = COLORS[name] ?? "#037971";
  const showLabel = width > 60 && height > 36;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} stroke="#fff" strokeWidth={2} />
      {showLabel && (
        <>
          <text x={x + 8} y={y + 18} fill="white" fontSize={11} fontWeight={600}>
            {name}
          </text>
          <text x={x + 8} y={y + 32} fill="rgba(255,255,255,0.8)" fontSize={10}>
            {formatUSDC(value)} ({pct})
          </text>
        </>
      )}
    </g>
  );
}

export function VaultTreemap() {
  const { data, isLoading, isError, refetch } = useVaultComposition();

  if (isLoading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Unable to load vault composition." onRetry={refetch} />;
  }

  if (!data || data.total === 0) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">Vault Allocation</h3>
        <div className="h-[200px] flex items-center justify-center text-sm text-[#6B8A8D]">No vault data yet</div>
      </div>
    );
  }

  const chartData = [
    { name: "Idle in Pool", value: data.idle, pct: `${((data.idle / data.total) * 100).toFixed(1)}%` },
    { name: "Lent Out", value: data.lent, pct: `${((data.lent / data.total) * 100).toFixed(1)}%` },
    { name: "T-Bills (USYC)", value: data.usyc, pct: `${((data.usyc / data.total) * 100).toFixed(1)}%` },
  ].filter((d) => d.value > 0);

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">Vault Allocation</h3>
        <span className="text-xs text-[#6B8A8D] tabular-nums font-[family-name:var(--font-heading)]">
          {formatUSDC(data.total)} total
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <Treemap
          data={chartData}
          dataKey="value"
          aspectRatio={4 / 3}
          content={<CustomContent />}
        >
          <Tooltip content={<TreemapTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
