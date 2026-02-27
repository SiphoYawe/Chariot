"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useBorrow } from "@/hooks/useBorrow";
import { RISK_PARAMS } from "@chariot/shared";
import { cn } from "@/lib/utils";

interface BorrowPanelProps {
  /** Collateral value in USDC */
  collateralValueUsdc: number;
  /** Current outstanding debt in USDC */
  currentDebt: number;
  /** Current borrow rate (0-1) */
  borrowRate: number;
  /** Current ETH price in USD */
  ethPrice: number;
  /** Collateral amount in ETH */
  collateralAmountEth: number;
  /** Callback when borrow succeeds */
  onSuccess?: () => void;
  /** Optional className */
  className?: string;
}

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(n: number): string {
  return (n * 100).toFixed(2) + "%";
}

export function BorrowPanel({
  collateralValueUsdc,
  currentDebt,
  borrowRate,
  ethPrice: _ethPrice,
  collateralAmountEth: _collateralAmountEth,
  onSuccess,
  className,
}: BorrowPanelProps) {
  const [amount, setAmount] = useState("");
  const { status, errorMessage, borrow, reset } = useBorrow();

  const parsedAmount = parseFloat(amount) || 0;
  const maxBorrow = Math.max(0, collateralValueUsdc * RISK_PARAMS.BRIDGED_ETH.BASE_LTV - currentDebt);
  const newTotalDebt = currentDebt + parsedAmount;

  // Projected health factor
  const projectedHF =
    newTotalDebt > 0
      ? (collateralValueUsdc * RISK_PARAMS.BRIDGED_ETH.LIQUIDATION_THRESHOLD) / newTotalDebt
      : Infinity;

  // Projected LTV
  const projectedLTV = collateralValueUsdc > 0 ? newTotalDebt / collateralValueUsdc : 0;

  // Remaining capacity after this borrow
  const remainingCapacity = Math.max(0, maxBorrow - parsedAmount);

  // Warning states
  const isDanger = parsedAmount > 0 && projectedHF < 1.0;
  const isCaution = parsedAmount > 0 && projectedHF >= 1.0 && projectedHF <= 1.2;
  const exceedsMax = parsedAmount > maxBorrow;

  const isBorrowing = status === "borrowing";

  const handleBorrow = async () => {
    await borrow(amount);
    onSuccess?.();
  };

  const handleMaxClick = () => {
    setAmount(maxBorrow.toFixed(2));
  };

  if (status === "confirmed") {
    return (
      <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-10 h-10 bg-[#03B5AA] flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10L8 14L16 6" stroke="white" strokeWidth="2" strokeLinecap="square" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-1">
            Borrowed ${formatUsd(parsedAmount)} USDC
          </h3>
          <p className="text-xs text-[#6B8A8D] mb-4">
            Health Factor: {projectedHF.toFixed(2)}
          </p>
          <Button
            onClick={reset}
            variant="outline"
            className="border-[#037971] text-[#037971] hover:bg-[#037971] hover:text-white"
          >
            Borrow More
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white", className)}>
      {/* Header */}
      <div className="p-6 border-b border-[rgba(3,121,113,0.08)]">
        <h3 className="text-base font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Borrow USDC
        </h3>
        <p className="text-xs text-[#6B8A8D] mt-1">
          Borrow against your BridgedETH collateral
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Amount input */}
        <div>
          <label className="text-xs font-medium text-[#6B8A8D] mb-1.5 block">
            Borrow Amount
          </label>
          <div
            className={cn(
              "flex items-center border transition-colors",
              isDanger
                ? "border-[#DC2626] focus-within:ring-2 focus-within:ring-[#DC2626]/20"
                : isCaution
                  ? "border-[#D97706] focus-within:ring-2 focus-within:ring-[#D97706]/20"
                  : "border-[rgba(3,121,113,0.15)] focus-within:border-[#03B5AA] focus-within:ring-2 focus-within:ring-[#03B5AA]/20"
            )}
          >
            <div className="px-3 py-2.5 bg-[#F8FAFA] border-r border-[rgba(3,121,113,0.08)]">
              <span className="text-sm font-medium text-[#023436]">USDC</span>
            </div>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d*\.?\d{0,2}$/.test(val) || val === "") {
                  setAmount(val);
                }
              }}
              disabled={isBorrowing}
              className="flex-1 px-3 py-2.5 text-sm text-[#023436] font-[family-name:var(--font-heading)] tabular-nums bg-transparent outline-none disabled:opacity-50"
            />
            <button
              onClick={handleMaxClick}
              disabled={isBorrowing}
              className="px-3 py-2.5 text-xs font-medium text-[#037971] hover:text-[#03B5AA] transition-colors disabled:opacity-50"
            >
              Max
            </button>
          </div>
          <p className="text-xs text-[#6B8A8D] mt-1 tabular-nums">
            Max borrowable: ${formatUsd(maxBorrow)}
          </p>
        </div>

        {/* Warnings */}
        {isDanger && (
          <div className="bg-[rgba(220,38,38,0.08)] border border-[rgba(220,38,38,0.2)] p-3">
            <p className="text-xs text-[#DC2626]">
              This amount would put your position at risk of immediate liquidation.
            </p>
          </div>
        )}
        {isCaution && (
          <div className="bg-[rgba(217,119,6,0.08)] border border-[rgba(217,119,6,0.2)] p-3">
            <p className="text-xs text-[#D97706]">
              This borrow amount leaves little safety margin. Health factor would be {projectedHF.toFixed(2)}.
            </p>
          </div>
        )}

        {/* Transaction preview */}
        {parsedAmount > 0 && !exceedsMax && (
          <div className="bg-[#F8FAFA] p-4 space-y-2.5">
            <div className="flex justify-between">
              <span className="text-xs text-[#6B8A8D]">Health Factor (After)</span>
              <span
                className={cn(
                  "text-xs font-[family-name:var(--font-heading)] tabular-nums font-semibold",
                  projectedHF > 1.5 ? "text-[#16A34A]" : projectedHF >= 1.0 ? "text-[#D97706]" : "text-[#DC2626]"
                )}
              >
                {projectedHF.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[#6B8A8D]">LTV (After)</span>
              <span className="text-xs text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
                {formatPercent(projectedLTV)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[#6B8A8D]">Borrow Rate</span>
              <span className="text-xs text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
                {formatPercent(borrowRate)} APR
              </span>
            </div>
            <div className="border-t border-[rgba(3,121,113,0.08)] pt-2.5">
              <div className="flex justify-between">
                <span className="text-xs text-[#6B8A8D]">Remaining Capacity</span>
                <span className="text-xs text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
                  ${formatUsd(remainingCapacity)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {errorMessage && (
          <div className="bg-[rgba(217,119,6,0.08)] border border-[rgba(217,119,6,0.2)] p-3">
            <p className="text-xs text-[#D97706]">{errorMessage}</p>
          </div>
        )}

        {/* Action button */}
        <Button
          onClick={handleBorrow}
          disabled={parsedAmount <= 0 || isDanger || exceedsMax || isBorrowing}
          className="w-full bg-[#03B5AA] text-white hover:bg-[#037971] font-medium h-11 disabled:opacity-40"
        >
          {isBorrowing ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin" style={{ borderRadius: "50%" }} />
              Borrowing...
            </span>
          ) : (
            "Borrow"
          )}
        </Button>
      </div>
    </div>
  );
}
