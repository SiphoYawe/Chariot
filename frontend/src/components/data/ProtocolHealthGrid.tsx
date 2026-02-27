"use client";

import { DataCard } from "./DataCard";
import { useProtocolHealth } from "@/hooks/useProtocolHealth";

export function ProtocolHealthGrid() {
  const { data, isLoading, isError, refetch } = useProtocolHealth();

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  return (
    <div className="grid grid-cols-4 gap-6">
      <DataCard
        label="Total Value Locked"
        value={data ? `$${fmt(data.tvl)}` : "--"}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
      />
      <DataCard
        label="Total Collateral"
        value={data ? `$${fmt(data.totalCollateral)}` : "--"}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
      />
      <DataCard
        label="Outstanding Debt"
        value={data ? `$${fmt(data.totalDebt)}` : "--"}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
      />
      <DataCard
        label="Protocol Reserves"
        value={data ? `$${fmt(data.protocolReserves)}` : "--"}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
      />
    </div>
  );
}
