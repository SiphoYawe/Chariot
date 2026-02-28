"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DateGroupedList } from "@/components/activity/DateGroupedList";
import {
  TransactionFilterBar,
  FILTER_TYPE_MAP,
  type FilterOption,
} from "@/components/activity/TransactionFilterBar";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { IconClockFilled } from "@tabler/icons-react";

function TransactionSkeletons() {
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3 border-b border-[rgba(3,121,113,0.15)] last:border-b-0"
        >
          <Skeleton className="w-9 h-9 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

function NoTransactions() {
  const router = useRouter();

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-8 flex flex-col items-center text-center">
      <div className="w-14 h-14 bg-[#F8FAFA] flex items-center justify-center mb-4">
        <IconClockFilled size={28} className="text-[#03B5AA]" />
      </div>
      <h3 className="text-lg font-semibold font-[family-name:var(--font-heading)] text-[#023436] mb-2">
        No transactions yet
      </h3>
      <p className="text-sm text-[#6B8A8D] max-w-sm mb-6">
        Your protocol activity will appear here
      </p>
      <div className="flex gap-3">
        <Button
          onClick={() => router.push("/lend")}
          className="bg-[#03B5AA] text-white hover:bg-[#037971] font-medium"
        >
          Start Lending
        </Button>
        <Button
          onClick={() => router.push("/borrow")}
          variant="outline"
          className="border-[rgba(3,121,113,0.15)] text-[#037971] hover:bg-[#F8FAFA] font-medium"
        >
          Start Borrowing
        </Button>
      </div>
    </div>
  );
}

function NoFilterResults({
  filter,
  onClear,
}: {
  filter: FilterOption;
  onClear: () => void;
}) {
  const labels: Record<FilterOption, string> = {
    all: "",
    deposits: "deposit",
    withdrawals: "withdrawal",
    borrows: "borrow",
    repays: "repay",
    liquidations: "liquidation",
    bridge: "bridge",
  };

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-8 flex flex-col items-center text-center">
      <p className="text-sm text-[#6B8A8D] mb-4">
        No {labels[filter]} transactions found
      </p>
      <button
        onClick={onClear}
        className="text-sm font-medium text-[#03B5AA] hover:text-[#037971] transition-colors"
      >
        Clear filter
      </button>
    </div>
  );
}

export default function HistoryPage() {
  const { data, isLoading, isError, refetch } = useTransactionHistory();
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");

  const filteredTransactions = useMemo(() => {
    if (!data) return null;
    const allowedTypes = FILTER_TYPE_MAP[activeFilter];
    if (!allowedTypes) return data;
    return data.filter((tx) => allowedTypes.includes(tx.type));
  }, [data, activeFilter]);

  return (
    <div className="pb-12">
      <PageHeader title="Transaction History" />

      {/* Filter bar */}
      <section className="mb-6">
        <TransactionFilterBar
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      </section>

      {/* Transaction list */}
      <section>
        {isLoading ? (
          <TransactionSkeletons />
        ) : isError ? (
          <ErrorState
            message="Unable to load transaction history. Click retry to try again."
            onRetry={refetch}
          />
        ) : filteredTransactions && filteredTransactions.length > 0 ? (
          <DateGroupedList transactions={filteredTransactions} />
        ) : data && data.length > 0 ? (
          <NoFilterResults
            filter={activeFilter}
            onClear={() => setActiveFilter("all")}
          />
        ) : (
          <NoTransactions />
        )}
      </section>
    </div>
  );
}
