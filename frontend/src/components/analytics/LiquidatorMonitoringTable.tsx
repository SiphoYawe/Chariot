"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useUserPosition } from "@/hooks/useUserPosition";
import { useAccount } from "wagmi";
import { truncateAddress } from "@/lib/utils";

function formatUSDC(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getHealthFactorStyle(hf: number): string {
  if (hf < 1.0) return "text-[#DC2626] font-bold animate-pulse";
  if (hf < 1.2) return "text-[#DC2626] font-semibold";
  if (hf <= 1.5) return "text-[#F59E0B] font-semibold";
  return "text-[#10B981] font-semibold";
}

function getHealthFactorLabel(hf: number): string {
  if (hf < 1.0) return "Liquidatable";
  if (hf < 1.2) return "At Risk";
  if (hf <= 1.5) return "Caution";
  return "Safe";
}

export function LiquidatorMonitoringTable() {
  const { address } = useAccount();
  const { data: position, isLoading, isError, refetch } = useUserPosition();

  if (isLoading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-48 mb-4" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Unable to load your position." onRetry={refetch} />;
  }

  if (!address || !position || !position.isActive) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
          Your Position
        </h3>
        <p className="text-sm text-[#6B8A8D] text-center py-8">
          No active position
        </p>
      </div>
    );
  }

  const hfStyle = getHealthFactorStyle(position.healthFactor);
  const hfLabel = getHealthFactorLabel(position.healthFactor);

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Your Position
        </h3>
        <span className="text-xs text-[#6B8A8D]">
          Health factor status
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-b border-[rgba(3,121,113,0.15)]">
            <TableHead className="text-left text-xs font-medium text-[#6B8A8D] uppercase tracking-wider">
              Address
            </TableHead>
            <TableHead className="text-right text-xs font-medium text-[#6B8A8D] uppercase tracking-wider">
              Collateral
            </TableHead>
            <TableHead className="text-right text-xs font-medium text-[#6B8A8D] uppercase tracking-wider">
              Debt
            </TableHead>
            <TableHead className="text-right text-xs font-medium text-[#6B8A8D] uppercase tracking-wider">
              Health Factor
            </TableHead>
            <TableHead className="text-right text-xs font-medium text-[#6B8A8D] uppercase tracking-wider">
              Status
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="border-b border-[rgba(3,121,113,0.15)]">
            <TableCell className="py-3">
              <span className="font-mono text-xs text-[#023436]">
                {truncateAddress(address)}
              </span>
            </TableCell>
            <TableCell className="py-3 text-right">
              <div>
                <span className="text-sm tabular-nums font-[family-name:var(--font-heading)] text-[#023436]">
                  {position.collateralAmount.toFixed(4)} ETH
                </span>
                <span className="text-xs text-[#9CA3AF] block">
                  {formatUSDC(position.collateralValueUsdc)}
                </span>
              </div>
            </TableCell>
            <TableCell className="py-3 text-right">
              <span className="text-sm tabular-nums font-[family-name:var(--font-heading)] text-[#023436]">
                {formatUSDC(position.outstandingDebt)}
              </span>
            </TableCell>
            <TableCell className="py-3 text-right">
              <div className="flex items-center justify-end gap-2">
                <span className={`text-sm tabular-nums font-[family-name:var(--font-heading)] ${hfStyle}`}>
                  {isFinite(position.healthFactor) ? position.healthFactor.toFixed(2) : "--"}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 ${
                    position.healthFactor < 1.0
                      ? "bg-[#DC2626]/10 text-[#DC2626] animate-pulse"
                      : position.healthFactor < 1.2
                      ? "bg-[#DC2626]/10 text-[#DC2626]"
                      : position.healthFactor <= 1.5
                      ? "bg-[#F59E0B]/10 text-[#F59E0B]"
                      : "bg-[#10B981]/10 text-[#10B981]"
                  }`}
                >
                  {hfLabel}
                </span>
              </div>
            </TableCell>
            <TableCell className="py-3 text-right">
              <span className="text-xs text-[#9CA3AF]">--</span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
