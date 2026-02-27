"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRepay } from "@/hooks/useRepay";
import { useWithdrawCollateral } from "@/hooks/useWithdrawCollateral";
import { cn } from "@/lib/utils";

interface RepayPanelProps {
  /** Current outstanding debt in USDC */
  outstandingDebt: number;
  /** Original borrowed principal in USDC */
  principal: number;
  /** Interest accrued in USDC */
  interestAccrued: number;
  /** Whether user has any debt */
  hasDebt: boolean;
  /** Collateral amount in ETH */
  collateralAmountEth: number;
  /** Callback when repay/withdraw succeeds */
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

export function RepayPanel({
  outstandingDebt,
  principal,
  interestAccrued,
  hasDebt,
  collateralAmountEth,
  onSuccess,
  className,
}: RepayPanelProps) {
  const [amount, setAmount] = useState("");
  const repay = useRepay();
  const withdraw = useWithdrawCollateral();

  const parsedAmount = parseFloat(amount) || 0;
  const isRepaying = repay.status === "repaying" || repay.status === "approving";
  const isWithdrawing = withdraw.status === "withdrawing";

  const handlePartialRepay = async () => {
    if (repay.needsApproval) {
      await repay.approve();
    }
    await repay.repay(amount);
    onSuccess?.();
  };

  const handleFullRepay = async () => {
    if (repay.needsApproval) {
      await repay.approve();
    }
    await repay.repayFull();
    onSuccess?.();
  };

  const handleWithdraw = async () => {
    await withdraw.withdraw(collateralAmountEth.toString());
    onSuccess?.();
  };

  if (repay.status === "confirmed") {
    return (
      <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-10 h-10 bg-[#03B5AA] flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10L8 14L16 6" stroke="white" strokeWidth="2" strokeLinecap="square" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-1">
            Repayment Complete
          </h3>
          <p className="text-xs text-[#6B8A8D] mb-4">
            Your debt has been reduced successfully.
          </p>
          <Button
            onClick={repay.reset}
            variant="outline"
            className="border-[#037971] text-[#037971] hover:bg-[#037971] hover:text-white"
          >
            Done
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
          Repay Debt
        </h3>
      </div>

      <div className="p-6 space-y-4">
        {/* Outstanding debt display */}
        <div className="bg-[#F8FAFA] p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-xs text-[#6B8A8D]">Outstanding Debt</span>
            <span className="text-sm font-bold text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
              ${formatUsd(outstandingDebt)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-[#6B8A8D]">Principal</span>
            <span className="text-xs text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
              ${formatUsd(principal)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-[#6B8A8D]">Interest Accrued</span>
            <span className="text-xs text-[#D97706] font-[family-name:var(--font-heading)] tabular-nums">
              +${formatUsd(interestAccrued)}
            </span>
          </div>
        </div>

        {hasDebt && (
          <>
            {/* Partial repay input */}
            <div>
              <label className="text-xs font-medium text-[#6B8A8D] mb-1.5 block">
                Repay Amount (USDC)
              </label>
              <div className="flex items-center border border-[rgba(3,121,113,0.15)] focus-within:border-[#03B5AA] focus-within:ring-2 focus-within:ring-[#03B5AA]/20 transition-colors">
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
                  disabled={isRepaying}
                  className="flex-1 px-3 py-2.5 text-sm text-[#023436] font-[family-name:var(--font-heading)] tabular-nums bg-transparent outline-none disabled:opacity-50"
                />
              </div>
              <p className="text-xs text-[#6B8A8D] mt-1">
                Collateral remains locked until full repayment.
              </p>
            </div>

            {/* Partial repay button */}
            <Button
              onClick={handlePartialRepay}
              disabled={parsedAmount <= 0 || isRepaying}
              variant="outline"
              className="w-full border-[#037971] text-[#037971] hover:bg-[#037971] hover:text-white h-11 font-medium disabled:opacity-40"
            >
              {isRepaying ? "Repaying..." : "Repay"}
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[rgba(3,121,113,0.08)]" />
              <span className="text-xs text-[#6B8A8D]">or</span>
              <div className="flex-1 h-px bg-[rgba(3,121,113,0.08)]" />
            </div>

            {/* Full repay button */}
            <Button
              onClick={handleFullRepay}
              disabled={isRepaying}
              className="w-full bg-[#03B5AA] text-white hover:bg-[#037971] font-medium h-11"
            >
              {isRepaying ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin" style={{ borderRadius: "50%" }} />
                  Repaying...
                </span>
              ) : (
                `Repay Full Balance ($${formatUsd(outstandingDebt)})`
              )}
            </Button>
          </>
        )}

        {/* Error */}
        {(repay.errorMessage || withdraw.errorMessage) && (
          <div className="bg-[rgba(217,119,6,0.08)] border border-[rgba(217,119,6,0.2)] p-3">
            <p className="text-xs text-[#D97706]">
              {repay.errorMessage || withdraw.errorMessage}
            </p>
          </div>
        )}

        {/* Withdraw collateral */}
        <div className="border-t border-[rgba(3,121,113,0.08)] pt-4">
          <Button
            onClick={handleWithdraw}
            disabled={hasDebt || isWithdrawing || collateralAmountEth <= 0}
            variant="outline"
            className={cn(
              "w-full h-11 font-medium",
              hasDebt
                ? "border-[rgba(3,121,113,0.15)] text-[#6B8A8D] cursor-not-allowed"
                : "border-[#037971] text-[#037971] hover:bg-[#037971] hover:text-white"
            )}
          >
            {isWithdrawing ? "Withdrawing..." : "Withdraw Collateral"}
          </Button>
          {hasDebt && (
            <p className="text-xs text-[#6B8A8D] mt-1 text-center">
              Repay all debt first to unlock collateral.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
