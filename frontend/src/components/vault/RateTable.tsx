"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RATE_TABLE_DATA } from "@/config/rateModel";
import { useVaultMetrics } from "@/hooks/useVaultMetrics";

export function RateTable() {
  const { data } = useVaultMetrics();
  const currentUtilisation = data?.utilisationRate ?? 0;

  // Find the closest utilisation level to the current rate
  const closestLevel = RATE_TABLE_DATA.reduce((prev, curr) =>
    Math.abs(curr.utilisation - currentUtilisation) <
    Math.abs(prev.utilisation - currentUtilisation)
      ? curr
      : prev
  ).utilisation;

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[#6B8A8D]">
          Interest Rate Schedule
        </h3>
        <p className="text-xs text-[#9CA3AF]">
          Rates increase sharply above 80% utilisation
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-[rgba(3,121,113,0.15)]">
            <TableHead className="text-left text-xs font-medium text-[#6B8A8D] uppercase tracking-wider">
              Utilisation %
            </TableHead>
            <TableHead className="text-right text-xs font-medium text-[#6B8A8D] uppercase tracking-wider">
              Borrow Rate %
            </TableHead>
            <TableHead className="text-right text-xs font-medium text-[#6B8A8D] uppercase tracking-wider">
              Supply APY %
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {RATE_TABLE_DATA.map((row) => {
            const isActive = row.utilisation === closestLevel;
            const isKink = row.utilisation === 80;
            const isAboveKink = row.utilisation > 80;

            return (
              <TableRow
                key={row.utilisation}
                className={`border-b border-[rgba(3,121,113,0.15)] transition-colors ${
                  isActive ? "bg-[#03B5AA]/10" : ""
                } ${isKink ? "border-b-2 border-b-[#037971]" : ""}`}
              >
                <TableCell className="py-3">
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <span className="w-1.5 h-1.5 bg-[#03B5AA]" />
                    )}
                    <span
                      className={`font-[family-name:var(--font-heading)] tabular-nums text-sm ${
                        isActive
                          ? "font-semibold text-[#023436]"
                          : "text-[#023436]"
                      }`}
                    >
                      {row.utilisation}%
                    </span>
                    {isKink && (
                      <span className="text-xs bg-[#037971]/10 text-[#037971] px-2 py-0.5 font-medium">
                        Optimal
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell
                  className={`py-3 text-right font-[family-name:var(--font-heading)] tabular-nums text-sm ${
                    isAboveKink
                      ? "text-[#DC2626] font-medium"
                      : "text-[#023436]"
                  }`}
                >
                  {row.borrowRate.toFixed(2)}
                </TableCell>
                <TableCell
                  className={`py-3 text-right font-[family-name:var(--font-heading)] tabular-nums text-sm ${
                    isActive
                      ? "font-semibold text-[#03B5AA]"
                      : "text-[#023436]"
                  }`}
                >
                  {row.supplyAPY.toFixed(2)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
