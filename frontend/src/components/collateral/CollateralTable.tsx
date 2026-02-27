"use client";

import { RISK_PARAMS } from "@chariot/shared";
import { formatEther } from "viem";

interface CollateralRow {
  token: string;
  symbol: string;
  amount: bigint;
  valueUsdc: number;
  ltv: number;
}

interface CollateralTableProps {
  /** Array of collateral rows */
  rows: CollateralRow[];
  /** Whether data is loading */
  isLoading?: boolean;
}

function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function SkeletonRow() {
  return (
    <tr>
      <td className="py-3 px-4">
        <div className="h-4 w-24 bg-[#F8FAFA] animate-pulse" />
      </td>
      <td className="py-3 px-4 text-right">
        <div className="h-4 w-20 bg-[#F8FAFA] animate-pulse ml-auto" />
      </td>
      <td className="py-3 px-4 text-right">
        <div className="h-4 w-24 bg-[#F8FAFA] animate-pulse ml-auto" />
      </td>
      <td className="py-3 px-4 text-right">
        <div className="h-4 w-12 bg-[#F8FAFA] animate-pulse ml-auto" />
      </td>
    </tr>
  );
}

export function CollateralTable({ rows, isLoading }: CollateralTableProps) {
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-[#F8FAFA]">
            <th className="text-left text-xs font-medium text-[#6B8A8D] font-[family-name:var(--font-heading)] py-3 px-4 uppercase tracking-wider">
              Asset
            </th>
            <th className="text-right text-xs font-medium text-[#6B8A8D] font-[family-name:var(--font-heading)] py-3 px-4 uppercase tracking-wider">
              Amount
            </th>
            <th className="text-right text-xs font-medium text-[#6B8A8D] font-[family-name:var(--font-heading)] py-3 px-4 uppercase tracking-wider">
              Value
            </th>
            <th className="text-right text-xs font-medium text-[#6B8A8D] font-[family-name:var(--font-heading)] py-3 px-4 uppercase tracking-wider">
              LTV
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center py-8 text-sm text-[#6B8A8D]">
                No collateral deposited
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.symbol}
                className="border-t border-[rgba(3,121,113,0.08)] hover:bg-[#F8FAFA] transition-colors"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-[#023436] flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">
                        {row.symbol.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-[#023436] font-[family-name:var(--font-heading)]">
                        {row.token}
                      </span>
                      <span className="text-xs text-[#6B8A8D] ml-1.5">
                        {row.symbol}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-sm text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
                    {parseFloat(formatEther(row.amount)).toFixed(4)}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-sm text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
                    ${formatNumber(row.valueUsdc)}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-sm text-[#037971] font-medium font-[family-name:var(--font-heading)] tabular-nums">
                    {(row.ltv * 100).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Build collateral rows from hook data */
export function buildCollateralRows(
  collateralBalance: bigint,
  collateralValueUsdc: number,
  ethPrice: number
): CollateralRow[] {
  if (collateralBalance === BigInt(0)) return [];

  return [
    {
      token: "BridgedETH",
      symbol: "bETH",
      amount: collateralBalance,
      valueUsdc: collateralValueUsdc || parseFloat(formatEther(collateralBalance)) * ethPrice,
      ltv: RISK_PARAMS.BRIDGED_ETH.BASE_LTV,
    },
  ];
}
