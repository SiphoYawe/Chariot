"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface BridgeAmountInputProps {
  /** Current USDC balance (display units, e.g. 5000.50) */
  balance: number;
  /** Whether balance is still loading */
  balanceLoading?: boolean;
  /** Selected destination chain name */
  destinationChain: string;
  /** Estimated delivery time string */
  estimatedDelivery: string;
  /** Bridge fee estimate */
  bridgeFee: number;
  /** Callback when amount changes */
  onAmountChange: (amount: string) => void;
  /** Current amount value */
  value: string;
  /** Optional className */
  className?: string;
}

export function BridgeAmountInput({
  balance,
  balanceLoading,
  destinationChain,
  estimatedDelivery,
  bridgeFee,
  onAmountChange,
  value,
  className,
}: BridgeAmountInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const numericValue = parseFloat(value) || 0;
  const insufficientBalance = numericValue > balance;

  const handleMax = () => {
    const maxAmount = Math.max(0, balance - bridgeFee);
    onAmountChange(maxAmount.toFixed(2));
  };

  const formatUsd = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
      <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
        Bridge Amount
      </h3>

      {/* Amount input */}
      <div
        className={cn(
          "border p-4 mb-4 transition-colors",
          isFocused
            ? "border-[#03B5AA]"
            : "border-[rgba(3,121,113,0.15)]",
          insufficientBalance && "border-[#F59E0B]"
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#6B8A8D]">Amount (USDC)</span>
          <button
            onClick={handleMax}
            className="text-xs text-[#03B5AA] font-medium hover:text-[#037971] transition-colors"
          >
            Max
          </button>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg text-[#6B8A8D] font-[family-name:var(--font-heading)]">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => {
              const val = e.target.value;
              // Allow only numbers and single decimal point
              if (/^\d*\.?\d{0,2}$/.test(val) || val === "") {
                onAmountChange(val);
              }
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="0.00"
            className="flex-1 text-2xl font-bold text-[#023436] font-[family-name:var(--font-heading)] tabular-nums bg-transparent outline-none placeholder:text-[#D1D5DB]"
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-[#6B8A8D]">
            Balance:{" "}
            {balanceLoading ? (
              <span className="inline-block w-16 h-3 bg-[#F8FAFA] animate-pulse" />
            ) : (
              <span className="tabular-nums">${formatUsd(balance)}</span>
            )}
          </span>
          {insufficientBalance && (
            <span className="text-xs text-[#F59E0B] font-medium">
              Insufficient balance
            </span>
          )}
        </div>
      </div>

      {/* Fee breakdown */}
      {numericValue > 0 && (
        <div className="space-y-2 pt-2 border-t border-[rgba(3,121,113,0.08)]">
          <div className="flex justify-between text-xs">
            <span className="text-[#6B8A8D]">Bridge fee</span>
            <span className="text-[#023436] tabular-nums font-[family-name:var(--font-heading)]">
              {bridgeFee > 0 ? `$${formatUsd(bridgeFee)}` : "Free"}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#6B8A8D]">Estimated gas</span>
            <span className="text-[#023436] tabular-nums font-[family-name:var(--font-heading)]">
              ~$0.01
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#6B8A8D]">Destination</span>
            <span className="text-[#023436] font-medium">{destinationChain}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#6B8A8D]">Est. delivery</span>
            <span className="text-[#023436] tabular-nums font-[family-name:var(--font-heading)]">
              {estimatedDelivery}
            </span>
          </div>
          <div className="flex justify-between text-xs pt-2 border-t border-[rgba(3,121,113,0.08)]">
            <span className="text-[#023436] font-medium">You receive</span>
            <span className="text-[#023436] font-bold tabular-nums font-[family-name:var(--font-heading)]">
              ${formatUsd(Math.max(0, numericValue - bridgeFee))} USDC
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
