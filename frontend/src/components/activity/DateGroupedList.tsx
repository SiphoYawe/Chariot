"use client";

import { useMemo, useState } from "react";
import type { Transaction } from "@/types/transaction";
import { TransactionRow } from "./TransactionRow";

interface DateGroup {
  label: string;
  date: string;
  transactions: Transaction[];
}

function getDateLabel(timestamp: number): { label: string; date: string } {
  const txDate = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const dateKey = txDate.toISOString().split("T")[0];

  if (isSameDay(txDate, today)) {
    return { label: "Today", date: dateKey };
  }
  if (isSameDay(txDate, yesterday)) {
    return { label: "Yesterday", date: dateKey };
  }

  const label = txDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return { label, date: dateKey };
}

interface DateGroupedListProps {
  transactions: Transaction[];
}

export function DateGroupedList({ transactions }: DateGroupedListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const groupMap = new Map<string, DateGroup>();
    const sorted = [...transactions].sort((a, b) => b.timestamp - a.timestamp);

    for (const tx of sorted) {
      const { label, date } = getDateLabel(tx.timestamp);
      if (!groupMap.has(date)) {
        groupMap.set(date, { label, date, transactions: [] });
      }
      groupMap.get(date)!.transactions.push(tx);
    }

    return Array.from(groupMap.values());
  }, [transactions]);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.date}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-[#6B8A8D] mb-2 px-4">
            {group.label}
          </h3>
          <div className="border border-[rgba(3,121,113,0.15)] bg-white">
            {group.transactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                expanded={expandedId === tx.id}
                onToggle={() =>
                  setExpandedId(expandedId === tx.id ? null : tx.id)
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
