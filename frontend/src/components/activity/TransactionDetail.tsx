"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Transaction } from "@/types/transaction";

const ARC_EXPLORER_BASE = "https://testnet.arcscan.app";

function truncateHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function formatUSDC(amount: number): string {
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDC`;
}

function formatETH(amount: number): string {
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })} ETH`;
}

// Type-specific detail fields derived from transaction data
// In production, these would come from event log data
function getTypeSpecificFields(
  tx: Transaction
): { label: string; value: string }[] {
  switch (tx.type) {
    case "deposit":
      return [
        { label: "Shares received", value: `${(tx.amount / 1.0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} chUSDC` },
        { label: "Share price", value: "$1.000000" },
      ];
    case "withdrawal":
      return [
        { label: "Shares burned", value: `${(tx.amount / 1.0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} chUSDC` },
        { label: "USDC received", value: formatUSDC(tx.amount) },
        { label: "Yield earned", value: "$0.00" },
      ];
    case "borrow":
      return [
        { label: "Collateral token", value: "BridgedETH" },
        { label: "Collateral value", value: "$4,875.00" },
        { label: "Health factor after", value: "1.60" },
        { label: "Borrow rate", value: "5.25%" },
      ];
    case "repay":
      return [
        { label: "Amount repaid", value: formatUSDC(tx.amount) },
        { label: "Remaining debt", value: formatUSDC(1300) },
        { label: "Type", value: "Partial" },
      ];
    case "collateral_deposit":
      return [
        { label: "Token", value: "BridgedETH" },
        { label: "Amount", value: formatETH(tx.amount) },
        { label: "USD value", value: `$${(tx.amount * 3250).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      ];
    case "collateral_withdrawal":
      return [
        { label: "Token", value: "BridgedETH" },
        { label: "Amount", value: formatETH(tx.amount) },
        { label: "USD value", value: `$${(tx.amount * 3250).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      ];
    case "liquidation":
      return [
        { label: "Liquidator", value: "0x1234...5678" },
        { label: "Collateral seized", value: formatETH(0.26) },
        { label: "Debt repaid", value: formatUSDC(tx.amount) },
        { label: "Bonus", value: "5.00%" },
      ];
    case "bridge":
      return [
        { label: "Source chain", value: "Arc Testnet" },
        { label: "Destination", value: "Ethereum Sepolia" },
        { label: "Bridge status", value: tx.status === "pending" ? "In transit" : "Delivered" },
      ];
    default:
      return [];
  }
}

interface TransactionDetailProps {
  transaction: Transaction;
}

export function TransactionDetail({ transaction }: TransactionDetailProps) {
  const typeFields = getTypeSpecificFields(transaction);
  const gasFee = 0.000012; // Mock gas fee in USDC

  return (
    <div className="px-4 py-3 bg-[#F8FAFA] border-b border-[rgba(3,121,113,0.15)]">
      <div className="grid grid-cols-2 gap-x-8 gap-y-2">
        {/* Common fields */}
        <DetailRow
          label="Transaction hash"
          value={
            <a
              href={`${ARC_EXPLORER_BASE}/tx/${transaction.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#03B5AA] hover:text-[#037971] transition-colors"
            >
              {truncateHash(transaction.txHash)}
              <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} />
            </a>
          }
        />
        <DetailRow
          label="Block number"
          value={
            <span className="tabular-nums font-[family-name:var(--font-heading)]">
              {transaction.blockNumber.toLocaleString()}
            </span>
          }
        />
        <DetailRow
          label="Gas fee"
          value={
            <span className="tabular-nums font-[family-name:var(--font-heading)]">
              {formatUSDC(gasFee)}
            </span>
          }
        />

        {/* Type-specific fields */}
        {typeFields.map((field) => (
          <DetailRow
            key={field.label}
            label={field.label}
            value={
              <span className="tabular-nums font-[family-name:var(--font-heading)]">
                {field.value}
              </span>
            }
          />
        ))}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-xs text-[#6B8A8D]">{label}</span>
      <span className="text-xs text-[#023436]">{value}</span>
    </div>
  );
}
