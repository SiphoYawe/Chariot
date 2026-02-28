"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { BridgeProgress } from "@/components/bridge/BridgeProgress";
import { NetworkBadge } from "@/components/bridge/NetworkBadge";
import { TransactionStepper, type StepConfig } from "@/components/transaction/TransactionStepper";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useETHEscrowDeposit } from "@/hooks/useETHEscrowDeposit";
import { useBridgeStatus } from "@/hooks/useBridgeStatus";
import { useETHUSDPrice } from "@/hooks/useETHUSDPrice";
import { useAccount, useBalance } from "wagmi";
import { ethereumSepolia } from "@/lib/chains";
import { RISK_PARAMS, ARC_CHAIN_ID } from "@chariot/shared";
import { IconWallet } from "@tabler/icons-react";

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function BridgePage() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");

  const { data: ethPrice } = useETHUSDPrice();
  const escrow = useETHEscrowDeposit();
  const bridge = useBridgeStatus(escrow.nonce);

  // ETH balance on Sepolia
  const { data: ethBalanceData, isLoading: ethBalanceLoading } = useBalance({
    address,
    chainId: ethereumSepolia.id,
    query: { enabled: !!address },
  });

  const ethBalance = ethBalanceData ? Number(ethBalanceData.formatted) : 0;
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
  const bridgeComplete = bridge.data?.isComplete ?? false;

  const getStepperSteps = (): StepConfig[] => {
    if (bridgeComplete) {
      return [
        { label: "Enter Amount", status: "completed" },
        { label: "Deposit ETH", status: "completed" },
        { label: "Bridge to Arc", status: "completed" },
        { label: "Collateral Ready", status: "completed" },
      ];
    }
    if (showBridgeProgress) {
      const stepIdx = bridge.data?.stepIndex ?? 0;
      return [
        { label: "Enter Amount", status: "completed" },
        { label: "Deposit ETH", status: "completed" },
        { label: "Bridge to Arc", status: stepIdx >= 2 ? "completed" : "active" },
        { label: "Collateral Ready", status: stepIdx >= 3 ? "completed" : "pending" },
      ];
    }
    if (isDepositing) {
      return [
        { label: "Enter Amount", status: "completed" },
        { label: "Deposit ETH", status: "active" },
        { label: "Bridge to Arc", status: "pending" },
        { label: "Collateral Ready", status: "pending" },
      ];
    }
    return [
      { label: "Enter Amount", status: "active" },
      { label: "Deposit ETH", status: "pending" },
      { label: "Bridge to Arc", status: "pending" },
      { label: "Collateral Ready", status: "pending" },
    ];
  };

  const handleDeposit = async () => {
    await escrow.deposit(amount);
  };

  const handleMaxClick = () => {
    if (ethBalance > 0) {
      const maxDeposit = Math.max(0, ethBalance - 0.01);
      setAmount(maxDeposit.toFixed(6));
    }
  };

  const handleReset = () => {
    escrow.reset();
    bridge.reset();
    setAmount("");
  };

  return (
    <div className="pb-12">
      <PageHeader title="Bridge" />

      {/* Transaction Stepper */}
      <section className="mb-8">
        <TransactionStepper steps={getStepperSteps()} />
      </section>

      {!isConnected ? (
        <EmptyState
          icon={IconWallet}
          headline="Connect Wallet"
          description="Connect your wallet to bridge ETH from Ethereum to Arc as collateral."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Input / Summary */}
          <div className="space-y-4">
            {!showBridgeProgress ? (
              <>
                {/* Bridge direction */}
                <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
                  <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
                    Bridge ETH as Collateral
                  </h3>

                  <div className="flex items-center gap-3 mb-5">
                    <NetworkBadge chainId={11155111} />
                    <div className="flex-1 flex items-center justify-center">
                      <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
                        <path d="M0 6H22M22 6L17 1M22 6L17 11" stroke="#03B5AA" strokeWidth="1.5" strokeLinecap="square" />
                      </svg>
                    </div>
                    <NetworkBadge chainId={ARC_CHAIN_ID} />
                  </div>

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
                    <div className="bg-[#F8FAFA] p-4 space-y-2.5 mt-4">
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
                      <div className="flex justify-between">
                        <span className="text-xs text-[#6B8A8D]">Bridge Fee</span>
                        <span className="text-xs text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
                          Free
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-[#6B8A8D]">Est. Bridge Time</span>
                        <span className="text-xs text-[#023436] font-[family-name:var(--font-heading)] tabular-nums">
                          ~1-2 min
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
                    <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] p-3 mt-4">
                      <p className="text-xs text-[#EF4444]">{escrow.errorMessage}</p>
                    </div>
                  )}

                  {/* Action button */}
                  <button
                    onClick={escrow.status === "error" ? () => escrow.reset() : handleDeposit}
                    disabled={escrow.status === "error" ? false : parsedAmount <= 0 || parsedAmount > ethBalance || isDepositing}
                    className={cn(
                      "w-full h-11 text-sm font-medium transition-colors mt-4",
                      escrow.status === "error"
                        ? "bg-[#03B5AA] text-white hover:bg-[#037971]"
                        : parsedAmount > 0 && parsedAmount <= ethBalance && !isDepositing
                          ? "bg-[#03B5AA] text-white hover:bg-[#037971]"
                          : isDepositing
                            ? "bg-[#037971] text-white cursor-wait"
                            : "bg-[#F8FAFA] text-[#9CA3AF] cursor-not-allowed"
                    )}
                  >
                    {isDepositing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin" style={{ borderRadius: "50%" }} />
                        {escrow.status === "switching-network" && "Switching to Sepolia..."}
                        {escrow.status === "awaiting-deposit" && "Confirm in wallet..."}
                        {escrow.status === "depositing" && "Depositing ETH..."}
                      </span>
                    ) : escrow.status === "error" ? (
                      "Try Again"
                    ) : parsedAmount > ethBalance && parsedAmount > 0 ? (
                      "Insufficient ETH Balance"
                    ) : (
                      "Deposit ETH to Bridge"
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* Bridge confirmed -- show summary */
              <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
                <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
                  Bridge Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B8A8D]">Amount</span>
                    <span className="text-[#023436] font-bold tabular-nums font-[family-name:var(--font-heading)]">
                      {parsedAmount.toFixed(6)} ETH
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B8A8D]">Collateral Value</span>
                    <span className="text-[#023436] tabular-nums font-[family-name:var(--font-heading)]">
                      ${formatUsd(collateralValue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#6B8A8D]">From</span>
                    <NetworkBadge chainId={11155111} compact />
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#6B8A8D]">To</span>
                    <NetworkBadge chainId={ARC_CHAIN_ID} compact />
                  </div>
                  {escrow.txHash && (
                    <div className="pt-3 border-t border-[rgba(3,121,113,0.08)]">
                      <span className="text-xs text-[#6B8A8D]">Sepolia tx: </span>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${escrow.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#03B5AA] font-mono tabular-nums hover:underline"
                      >
                        {escrow.txHash.slice(0, 10)}...{escrow.txHash.slice(-8)}
                      </a>
                    </div>
                  )}
                </div>

                {bridgeComplete && (
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={handleReset}
                      className="flex-1 bg-[#F8FAFA] text-[#023436] hover:bg-[#EEF2F2] h-11 text-sm font-medium transition-colors"
                    >
                      Bridge More
                    </button>
                    <a
                      href="/borrow"
                      className="flex-1 bg-[#03B5AA] text-white hover:bg-[#037971] h-11 text-sm font-medium transition-colors flex items-center justify-center"
                    >
                      Borrow USDC
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column: Progress / Info */}
          <div>
            {showBridgeProgress && bridge.data ? (
              <BridgeProgress
                currentStep={bridge.data.currentStep}
                isComplete={bridge.data.isComplete}
                isDelayed={bridge.data.isDelayed}
                estimatedTimeRemaining={bridge.data.estimatedTimeRemaining}
              />
            ) : isDepositing ? (
              <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
                <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
                  Transaction in Progress
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-[#03B5AA] flex items-center justify-center">
                    <span
                      className="w-2 h-2 bg-white animate-pulse"
                      style={{ borderRadius: "50%" }}
                    />
                  </div>
                  <span className="text-sm text-[#023436]">
                    {escrow.status === "switching-network"
                      ? "Switching to Ethereum Sepolia..."
                      : escrow.status === "awaiting-deposit"
                        ? "Awaiting wallet confirmation..."
                        : "Depositing ETH into escrow..."}
                  </span>
                </div>
                <p className="text-xs text-[#6B8A8D] mt-3">
                  Please confirm the transaction in your wallet.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* How it works */}
                <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
                  <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
                    How ETH Bridging Works
                  </h3>
                  <div className="space-y-3">
                    {[
                      { step: "1", label: "Enter the ETH amount you want to bridge" },
                      { step: "2", label: "Deposit ETH into the escrow on Ethereum Sepolia" },
                      { step: "3", label: "Our relayer detects the deposit and mints BridgedETH on Arc" },
                      { step: "4", label: "BridgedETH is auto-deposited as collateral" },
                      { step: "5", label: "Borrow USDC against your collateral on Arc" },
                    ].map(({ step, label }) => (
                      <div key={step} className="flex items-start gap-3">
                        <div className="w-5 h-5 bg-[#023436] flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-white">{step}</span>
                        </div>
                        <span className="text-sm text-[#023436]">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-[rgba(3,121,113,0.08)]">
                    <p className="text-xs text-[#6B8A8D]">
                      Your ETH is locked in a secure escrow contract on Ethereum.
                      You can withdraw it anytime by burning your BridgedETH on Arc.
                      If bridging takes longer than 24 hours, you can self-refund.
                    </p>
                  </div>
                </div>

                {/* CCTP Coming Soon */}
                <div className="border border-[rgba(3,121,113,0.08)] bg-[#F8FAFA] p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#03B5AA] bg-[rgba(3,181,170,0.12)] px-2 py-0.5">
                      Coming Soon
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
                    USDC Bridging via CCTP
                  </h4>
                  <p className="text-xs text-[#6B8A8D] mt-1">
                    Bridge borrowed USDC from Arc to Ethereum, Base, or Arbitrum
                    using Circle&apos;s Cross-Chain Transfer Protocol.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
