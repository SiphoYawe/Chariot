"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BridgeProgress } from "@/components/bridge/BridgeProgress";
import { useETHEscrowDeposit } from "@/hooks/useETHEscrowDeposit";
import { useBridgeStatus } from "@/hooks/useBridgeStatus";
import { useETHUSDPrice } from "@/hooks/useETHUSDPrice";
import { RISK_PARAMS } from "@chariot/shared";
import { cn } from "@/lib/utils";
import { useAccount, useBalance } from "wagmi";
import { ethereumSepolia } from "@/lib/chains";

interface CollateralDepositFlowProps {
  /** Callback when bridge completes and collateral is deposited */
  onComplete?: () => void;
  /** Optional className */
  className?: string;
}

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CollateralDepositFlow({
  onComplete,
  className,
}: CollateralDepositFlowProps) {
  const [amount, setAmount] = useState("");
  const { data: ethPrice } = useETHUSDPrice();
  const escrow = useETHEscrowDeposit();
  const bridge = useBridgeStatus(escrow.nonce);

  const { address } = useAccount();
  const { data: ethBalanceData, isLoading: ethBalanceLoading } = useBalance({
    address,
    chainId: ethereumSepolia.id,
    query: { enabled: !!address },
  });

  const ethBalance = ethBalanceData
    ? Number(ethBalanceData.formatted)
    : 0;
  const ethBalanceDisplay = ethBalance.toFixed(4);

  const parsedAmount = parseFloat(amount) || 0;
  const price = ethPrice?.price ?? 0;
  const collateralValue = parsedAmount * price;
  const maxBorrow = collateralValue * RISK_PARAMS.BRIDGED_ETH.BASE_LTV;

  const isDepositing =
    escrow.status === "switching-network" ||
    escrow.status === "awaiting-deposit" ||
    escrow.status === "depositing";

  const showBridgeProgress = escrow.status === "confirmed" && bridge.data !== null;

  // Trigger onComplete when bridge finishes
  if (bridge.data?.isComplete && onComplete) {
    onComplete();
  }

  const handleDeposit = async () => {
    await escrow.deposit(amount);
  };

  const handleMaxClick = () => {
    if (ethBalance > 0) {
      // Leave a small amount for gas
      const maxDeposit = Math.max(0, ethBalance - 0.01);
      setAmount(maxDeposit.toFixed(6));
    }
  };

  return (
    <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white", className)}>
      {/* Header */}
      <div className="p-6 border-b border-[rgba(3,121,113,0.08)]">
        <h3 className="text-base font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Deposit ETH Collateral
        </h3>
        <p className="text-xs text-[#6B8A8D] mt-1">
          Lock ETH on Ethereum Sepolia to bridge as collateral on Arc
        </p>
      </div>

      {!showBridgeProgress ? (
        <div className="p-6 space-y-4">
          {/* Amount input */}
          <div>
            <label className="text-xs font-medium text-[#6B8A8D] mb-1.5 block font-[family-name:var(--font-body)]">
              ETH Amount
            </label>
            <div className="flex items-center border border-[rgba(3,121,113,0.15)] focus-within:border-[#03B5AA] focus-within:ring-2 focus-within:ring-[#03B5AA]/20 transition-colors">
              <div className="px-3 py-2.5 bg-[#F8FAFA] border-r border-[rgba(3,121,113,0.08)]">
                <span className="text-sm font-medium text-[#023436]">ETH</span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^\d*\.?\d{0,6}$/.test(val) || val === "") {
                    setAmount(val);
                  }
                }}
                disabled={isDepositing}
                className="flex-1 px-3 py-2.5 text-sm text-[#023436] font-[family-name:var(--font-heading)] tabular-nums bg-transparent outline-none disabled:opacity-50"
              />
              <button
                onClick={handleMaxClick}
                disabled={isDepositing}
                className="px-3 py-2.5 text-xs font-medium text-[#037971] hover:text-[#03B5AA] transition-colors disabled:opacity-50"
              >
                Max
              </button>
            </div>
            <p className="text-xs text-[#6B8A8D] mt-1 tabular-nums">
              {ethBalanceLoading ? (
                <span className="inline-block w-28 h-3 bg-[#F8FAFA] animate-pulse" />
              ) : (
                <>Balance: {ethBalanceDisplay} ETH (Sepolia)</>
              )}
            </p>
          </div>

          {/* Transaction preview */}
          {parsedAmount > 0 && (
            <div className="bg-[#F8FAFA] p-4 space-y-2.5">
              <div className="flex justify-between">
                <span className="text-xs text-[#6B8A8D]">ETH Price</span>
                <span className="text-xs text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
                  ${formatUsd(price)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[#6B8A8D]">Collateral Value</span>
                <span className="text-xs text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
                  ${formatUsd(collateralValue)}
                </span>
              </div>
              <div className="border-t border-[rgba(3,121,113,0.08)] pt-2.5">
                <div className="flex justify-between">
                  <span className="text-xs text-[#6B8A8D]">Max Borrow (75% LTV)</span>
                  <span className="text-xs font-semibold text-[#03B5AA] font-[family-name:var(--font-heading)] tabular-nums">
                    ${formatUsd(maxBorrow)} USDC
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {escrow.errorMessage && (
            <div className="bg-[rgba(217,119,6,0.08)] border border-[rgba(217,119,6,0.2)] p-3">
              <p className="text-xs text-[#D97706]">{escrow.errorMessage}</p>
            </div>
          )}

          {/* Action button */}
          <Button
            onClick={handleDeposit}
            disabled={parsedAmount <= 0 || isDepositing}
            className="w-full bg-[#03B5AA] text-white hover:bg-[#037971] font-medium h-11 disabled:opacity-40"
          >
            {isDepositing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin" style={{ borderRadius: "50%" }} />
                {escrow.status === "switching-network" && "Switching to Sepolia..."}
                {escrow.status === "awaiting-deposit" && "Awaiting confirmation..."}
                {escrow.status === "depositing" && "Depositing ETH..."}
              </span>
            ) : (
              "Deposit ETH"
            )}
          </Button>

          {/* Flow explanation */}
          <p className="text-[10px] text-[#6B8A8D] text-center leading-relaxed">
            Deposit ETH on Ethereum &rarr; Bridge to Arc &rarr; Use as collateral &rarr; Borrow USDC
          </p>
        </div>
      ) : (
        /* Bridge progress view */
        <div className="p-6">
          {bridge.data && (
            <BridgeProgress
              currentStep={bridge.data.currentStep}
              isComplete={bridge.data.isComplete}
              isDelayed={bridge.data.isDelayed}
              estimatedTimeRemaining={bridge.data.estimatedTimeRemaining}
            />
          )}

          {bridge.data?.isComplete && (
            <Button
              onClick={() => {
                escrow.reset();
                bridge.reset();
              }}
              className="w-full mt-4 bg-[#03B5AA] text-white hover:bg-[#037971] font-medium h-11"
            >
              Continue to Borrow
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
