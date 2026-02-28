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
import { useBorrowerPositions, type BorrowerPosition } from "@/hooks/useBorrowerPositions";
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

function PositionRow({ position }: { position: BorrowerPosition }) {
  const hfStyle = getHealthFactorStyle(position.healthFactor);

  return (
    <TableRow className="border-b border-[rgba(3,121,113,0.15)]">
      <TableCell className="py-3">
        <span className="font-mono text-xs text-[#023436]">
          {truncateAddress(position.address)}
        </span>
      </TableCell>
      <TableCell className="py-3 text-right">
        <div>
          <span className="text-sm tabular-nums font-[family-name:var(--font-heading)] text-[#023436]">
            {position.collateralAmount.toFixed(2)} {position.collateralType}
          </span>
          <span className="text-xs text-[#9CA3AF] block">
            {formatUSDC(position.collateralValueUSD)}
          </span>
        </div>
      </TableCell>
      <TableCell className="py-3 text-right">
        <span className="text-sm tabular-nums font-[family-name:var(--font-heading)] text-[#023436]">
          {formatUSDC(position.debtAmount)}
        </span>
      </TableCell>
      <TableCell className="py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className={`text-sm tabular-nums font-[family-name:var(--font-heading)] ${hfStyle}`}>
            {position.healthFactor.toFixed(2)}
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
            {getHealthFactorLabel(position.healthFactor)}
          </span>
        </div>
      </TableCell>
      <TableCell className="py-3 text-right">
        {position.healthFactor < 1.0 ? (
          <Button
            variant="destructive"
            size="sm"
            className="h-7 px-3 text-xs bg-[#DC2626] hover:bg-[#DC2626]/90"
          >
            Liquidate
          </Button>
        ) : (
          <span className="text-xs text-[#9CA3AF]">--</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export function LiquidatorMonitoringTable() {
  const { positions, isLoading, isError, refetch } = useBorrowerPositions();

  if (isLoading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-48 mb-4" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Unable to load borrower positions." onRetry={refetch} />;
  }

  if (positions.length === 0) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
          Borrower Positions
        </h3>
        <p className="text-sm text-[#6B8A8D] text-center py-8">
          No active borrower positions
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Borrower Positions
        </h3>
        <span className="text-xs text-[#6B8A8D]">
          Sorted by health factor (lowest first)
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
              Action
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((position) => (
            <PositionRow key={position.address} position={position} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
