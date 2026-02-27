"use client";

import { DataCard } from "./DataCard";
import { useVaultMetrics } from "@/hooks/useVaultMetrics";

export function ProtocolMetricsGrid() {
  const { data, isLoading, isError, refetch } = useVaultMetrics();

  return (
    <div className="grid grid-cols-3 gap-6">
      <DataCard
        label="Total Vault Assets"
        value={data ? `$${formatUSDC(data.totalAssets)}` : "--"}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
      />
      <DataCard
        label="USDC Lent Out"
        value={data ? `$${formatUSDC(data.totalBorrowed)}` : "--"}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
      />
      <DataCard
        label="USDC Idle in Pool"
        value={data ? `$${formatUSDC(data.totalIdle)}` : "--"}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
      />
      <DataCard
        label="USDC in USYC"
        value={data ? `$${formatUSDC(data.usycAllocated)}` : "--"}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
      />
      <DataCard
        label="chUSDC Share Price"
        value={data ? `$${data.sharePrice.toFixed(6)}` : "--"}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
      />
      <DataCard
        label="Pool Utilisation"
        value={data ? `${data.utilisationRate.toFixed(2)}%` : "--"}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
      />
    </div>
  );
}

function formatUSDC(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
