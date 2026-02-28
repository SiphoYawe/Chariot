"use client";

import type { TransactionType } from "@/types/transaction";

export type FilterOption = "all" | "deposits" | "withdrawals" | "borrows" | "repays" | "liquidations" | "bridge";

const FILTER_OPTIONS: { label: string; value: FilterOption }[] = [
  { label: "All", value: "all" },
  { label: "Deposits", value: "deposits" },
  { label: "Withdrawals", value: "withdrawals" },
  { label: "Borrows", value: "borrows" },
  { label: "Repays", value: "repays" },
  { label: "Liquidations", value: "liquidations" },
  { label: "Bridge", value: "bridge" },
];

// Maps filter option to matching transaction types
export const FILTER_TYPE_MAP: Record<FilterOption, TransactionType[] | null> = {
  all: null,
  deposits: ["deposit", "collateral_deposit"],
  withdrawals: ["withdrawal", "collateral_withdrawal"],
  borrows: ["borrow"],
  repays: ["repay"],
  liquidations: ["liquidation"],
  bridge: ["bridge"],
};

interface TransactionFilterBarProps {
  activeFilter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
}

export function TransactionFilterBar({
  activeFilter,
  onFilterChange,
}: TransactionFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTER_OPTIONS.map((option) => {
        const isActive = activeFilter === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onFilterChange(option.value)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-[#03B5AA] text-white"
                : "border border-[rgba(3,121,113,0.3)] text-[#023436] hover:bg-[#F8FAFA]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
