"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useBorrowerPositions } from "@/hooks/useBorrowerPositions";
import { truncateAddress } from "@/lib/utils";

function formatUSDC(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

interface BorrowerTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { name: string; value: number; fullAddress: string };
  }>;
}

function BorrowerTooltip({ active, payload }: BorrowerTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-3 shadow-sm">
      <p className="text-xs font-mono text-[#6B8A8D] mb-1">
        {entry.payload.fullAddress.slice(0, 10)}...{entry.payload.fullAddress.slice(-6)}
      </p>
      <p className="text-sm font-semibold tabular-nums font-[family-name:var(--font-heading)] text-[#023436]">
        {formatUSDC(entry.value)} collateral
      </p>
    </div>
  );
}

export function TopBorrowersList() {
  const { positions, isLoading, isError, refetch } = useBorrowerPositions();

  if (isLoading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Unable to load top borrowers." onRetry={refetch} />;
  }

  // Sort by collateral value descending, take top 10
  const topBorrowers = [...positions]
    .sort((a, b) => b.collateralValueUSD - a.collateralValueUSD)
    .slice(0, 10)
    .map((p) => ({
      name: truncateAddress(p.address),
      value: p.collateralValueUSD,
      fullAddress: p.address,
    }));

  if (topBorrowers.length === 0) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
          Top Positions by Collateral
        </h3>
        <p className="text-sm text-[#6B8A8D] text-center py-8">
          No positions to display
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
        Top Positions by Collateral
      </h3>

      <ResponsiveContainer width="100%" height={topBorrowers.length * 36 + 20}>
        <BarChart
          data={topBorrowers}
          layout="vertical"
          margin={{ top: 0, right: 4, bottom: 0, left: 0 }}
        >
          <XAxis
            type="number"
            tickFormatter={formatUSDC}
            tick={{ fontSize: 10, fill: "#6B8A8D" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={80}
            tick={{ fontSize: 10, fill: "#6B8A8D", fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<BorrowerTooltip />} />
          <Bar
            dataKey="value"
            fill="#03B5AA"
            animationDuration={500}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
