"use client";

import { useVaultMetrics } from "./useVaultMetrics";

export interface VaultCompositionData {
  idle: number;
  lent: number;
  usyc: number;
  total: number;
}

export function useVaultComposition() {
  const { data, isLoading, isError, refetch } = useVaultMetrics();

  const composition: VaultCompositionData | null = data
    ? {
        idle: data.totalIdle,
        lent: data.totalBorrowed,
        usyc: data.usycAllocated,
        total: data.totalAssets,
      }
    : null;

  return { data: composition, isLoading, isError, refetch };
}
