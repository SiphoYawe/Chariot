"use client";

import { IconArrowDownCircleFilled, IconArrowUpCircleFilled, IconCoinFilled, IconSend, IconShieldFilled, IconShieldCheckFilled, IconAlertTriangleFilled, IconArrowsExchange, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import type { Transaction, TransactionType } from "@/types/transaction";
import { TRANSACTION_TYPE_LABELS } from "@/types/transaction";
import { TransactionDetail } from "./TransactionDetail";

const TYPE_ICONS: Record<TransactionType, Icon> = {
  deposit: IconArrowDownCircleFilled,
  withdrawal: IconArrowUpCircleFilled,
  borrow: IconCoinFilled,
  repay: IconSend,
  collateral_deposit: IconShieldFilled,
  collateral_withdrawal: IconShieldCheckFilled,
  liquidation: IconAlertTriangleFilled,
  bridge: IconArrowsExchange,
};

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-[#10B981]/10 text-[#10B981]",
  pending: "bg-[#F59E0B]/10 text-[#F59E0B]",
  failed: "bg-[#DC2626]/10 text-[#DC2626]",
};

function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);

  const today = new Date();
  const txDate = new Date(timestamp);
  const isToday =
    today.getFullYear() === txDate.getFullYear() &&
    today.getMonth() === txDate.getMonth() &&
    today.getDate() === txDate.getDate();

  if (isToday) {
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    return `${hours}h ago`;
  }

  return txDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatAmount(amount: number, asset: string): string {
  const decimals = asset === "ETH" || asset === "BridgedETH" ? 4 : 2;
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${asset}`;
}

interface TransactionRowProps {
  transaction: Transaction;
  expanded: boolean;
  onToggle: () => void;
}

export function TransactionRow({
  transaction,
  expanded,
  onToggle,
}: TransactionRowProps) {
  const IconComp = TYPE_ICONS[transaction.type];
  const label = TRANSACTION_TYPE_LABELS[transaction.type];

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-4 py-3 border-b border-[rgba(3,121,113,0.15)] last:border-b-0 hover:bg-[#F8FAFA] transition-colors text-left"
      >
        {/* Icon */}
        <div className="w-9 h-9 flex items-center justify-center bg-[#F8FAFA] shrink-0">
          <IconComp size={18} className="text-[#037971]" />
        </div>

        {/* Type & timestamp */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#023436]">{label}</p>
          <p className="text-xs text-[#6B8A8D]">
            {formatTimestamp(transaction.timestamp)}
          </p>
        </div>

        {/* Amount */}
        <div className="text-right">
          <p className="text-sm font-medium tabular-nums font-[family-name:var(--font-heading)] text-[#023436]">
            {formatAmount(transaction.amount, transaction.asset)}
          </p>
        </div>

        {/* Status badge */}
        <span
          className={`px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[transaction.status]}`}
        >
          {transaction.status}
        </span>

        {/* Chevron */}
        {expanded ? (
          <IconChevronUp size={16} className="text-[#6B8A8D] shrink-0" />
        ) : (
          <IconChevronDown size={16} className="text-[#6B8A8D] shrink-0" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && <TransactionDetail transaction={transaction} />}
    </div>
  );
}
