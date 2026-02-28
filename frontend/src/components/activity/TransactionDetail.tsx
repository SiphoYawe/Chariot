"use client";

import { IconArrowUpRight } from "@tabler/icons-react";
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

function getTypeSpecificFields(
  tx: Transaction
): { label: string; value: string }[] {
  switch (tx.type) {
    case "deposit":
      return [
        { label: "Asset", value: tx.asset },
        { label: "Amount deposited", value: formatUSDC(tx.amount) },
      ];
    case "withdrawal":
      return [
        { label: "Asset", value: tx.asset },
        { label: "USDC received", value: formatUSDC(tx.amount) },
      ];
    case "borrow":
      return [
        { label: "Collateral token", value: "BridgedETH" },
        { label: "Amount borrowed", value: formatUSDC(tx.amount) },
      ];
    case "repay":
      return [
        { label: "Amount repaid", value: formatUSDC(tx.amount) },
      ];
    case "collateral_deposit":
      return [
        { label: "Token", value: "BridgedETH" },
        { label: "Amount", value: formatETH(tx.amount) },
      ];
    case "collateral_withdrawal":
      return [
        { label: "Token", value: "BridgedETH" },
        { label: "Amount", value: formatETH(tx.amount) },
      ];
    case "liquidation":
      return [
        { label: "Debt repaid", value: formatUSDC(tx.amount) },
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
  const gasFee = 0.01; // Estimated gas fee in USDC (Arc Testnet)

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
              <IconArrowUpRight size={14} />
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
