"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { ChainSelector } from "@/components/bridge/ChainSelector";
import { BridgeAmountInput } from "@/components/bridge/BridgeAmountInput";
import { CCTPBridgeProgress } from "@/components/bridge/CCTPBridgeProgress";
import { NetworkBadge } from "@/components/bridge/NetworkBadge";
import { TransactionStepper, type StepConfig } from "@/components/transaction/TransactionStepper";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useBridgeUSDC } from "@/hooks/useBridgeUSDC";
import { useCCTPBridgeStatus } from "@/hooks/useCCTPBridgeStatus";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { ADDRESSES, ERC20ABI, POLLING_INTERVAL_MS } from "@chariot/shared";
import { Wallet03Icon } from "@hugeicons/core-free-icons";
import { CCTP_DOMAINS, CCTP_CHAIN_INFO, ARC_CHAIN_ID } from "@chariot/shared";

/** Map frontend chain IDs to CCTP domain IDs */
const CHAIN_TO_CCTP_DOMAIN: Record<number, number> = {
  11155111: CCTP_DOMAINS.ETHEREUM,
  84532: CCTP_DOMAINS.BASE,
  421614: CCTP_DOMAINS.ARBITRUM,
};

export default function BridgePage() {
  const { address, isConnected } = useAccount();
  const [selectedChain, setSelectedChain] = useState(11155111);
  const [amount, setAmount] = useState("");
  const { status, txHash, errorMessage, bridge, reset } = useBridgeUSDC();
  const cctpStatus = useCCTPBridgeStatus(txHash);

  // Read real USDC balance on Arc
  const { data: rawUsdcBalance } = useReadContract({
    address: ADDRESSES.USDC as `0x${string}`,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: POLLING_INTERVAL_MS,
    },
  });
  const usdcBalance = rawUsdcBalance !== undefined
    ? Number(formatUnits(rawUsdcBalance as bigint, 6))
    : 0;

  const domain = CHAIN_TO_CCTP_DOMAIN[selectedChain];
  const chainInfo =
    domain !== undefined
      ? CCTP_CHAIN_INFO[domain as keyof typeof CCTP_CHAIN_INFO]
      : null;
  const chainName = chainInfo?.name ?? "Unknown";
  const estimatedDelivery = chainInfo
    ? `~${Math.ceil(chainInfo.estimatedDeliverySeconds / 60)} min`
    : "~19 min";

  const numericAmount = parseFloat(amount) || 0;
  const canBridge =
    numericAmount > 0 && numericAmount <= usdcBalance && status === "idle";
  const isBridging = status === "approving" || status === "bridging";
  const isConfirmed = status === "confirmed";
  const bridgeComplete = isConfirmed && cctpStatus.data?.isComplete;

  const getStepperSteps = (): StepConfig[] => {
    if (bridgeComplete) {
      return [
        { label: "Enter Amount", status: "completed" },
        { label: "Approve & Bridge", status: "completed" },
        { label: "CCTP Processing", status: "completed" },
        { label: "Delivered", status: "completed" },
      ];
    }
    if (isConfirmed) {
      return [
        { label: "Enter Amount", status: "completed" },
        { label: "Approve & Bridge", status: "completed" },
        { label: "CCTP Processing", status: "active" },
        { label: "Delivered", status: "pending" },
      ];
    }
    if (isBridging) {
      return [
        { label: "Enter Amount", status: "completed" },
        { label: "Approve & Bridge", status: "active" },
        { label: "CCTP Processing", status: "pending" },
        { label: "Delivered", status: "pending" },
      ];
    }
    return [
      { label: "Enter Amount", status: "active" },
      { label: "Approve & Bridge", status: "pending" },
      { label: "CCTP Processing", status: "pending" },
      { label: "Delivered", status: "pending" },
    ];
  };

  const handleBridge = async () => {
    if (!address || domain === undefined) return;
    await bridge(amount, domain, address);
  };

  const handleReset = () => {
    reset(); // Sets txHash to null, which triggers useCCTPBridgeStatus cleanup
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
          icon={Wallet03Icon}
          headline="Connect Wallet"
          description="Connect your wallet to bridge USDC from Arc to other chains via CCTP."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Input / Summary */}
          <div className="space-y-4">
            {!isConfirmed ? (
              <>
                <BridgeAmountInput
                  balance={usdcBalance}
                  destinationChain={chainName}
                  estimatedDelivery={estimatedDelivery}
                  bridgeFee={0}
                  onAmountChange={setAmount}
                  value={amount}
                />

                <ChainSelector
                  selectedChainId={selectedChain}
                  onSelect={setSelectedChain}
                  excludeChainIds={[ARC_CHAIN_ID]}
                />

                {/* Bridge action button */}
                <button
                  onClick={status === "error" ? handleReset : handleBridge}
                  disabled={status === "error" ? false : !canBridge || isBridging}
                  className={cn(
                    "w-full h-11 text-sm font-medium transition-colors",
                    status === "error"
                      ? "bg-[#03B5AA] text-white hover:bg-[#037971]"
                      : canBridge && !isBridging
                        ? "bg-[#03B5AA] text-white hover:bg-[#037971]"
                        : isBridging
                          ? "bg-[#037971] text-white cursor-wait"
                          : "bg-[#F8FAFA] text-[#9CA3AF] cursor-not-allowed"
                  )}
                >
                  {status === "approving"
                    ? "Approving USDC..."
                    : status === "bridging"
                      ? "Bridging..."
                      : status === "error"
                        ? "Try Again"
                        : "Bridge USDC"}
                </button>

                {/* Error message */}
                {status === "error" && errorMessage && (
                  <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] p-3">
                    <p className="text-xs text-[#EF4444]">{errorMessage}</p>
                  </div>
                )}
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
                      {numericAmount.toFixed(2)} USDC
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#6B8A8D]">From</span>
                    <NetworkBadge chainId={ARC_CHAIN_ID} compact />
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#6B8A8D]">To</span>
                    <NetworkBadge chainId={selectedChain} compact />
                  </div>
                  {txHash && (
                    <div className="pt-3 border-t border-[rgba(3,121,113,0.08)]">
                      <span className="text-xs text-[#6B8A8D]">Source tx: </span>
                      <span className="text-xs text-[#023436] font-mono tabular-nums">
                        {txHash.slice(0, 10)}...{txHash.slice(-8)}
                      </span>
                    </div>
                  )}
                </div>

                {bridgeComplete && (
                  <button
                    onClick={handleReset}
                    className="w-full mt-6 bg-[#03B5AA] text-white hover:bg-[#037971] h-11 text-sm font-medium transition-colors"
                  >
                    Bridge More USDC
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right column: Progress / Info */}
          <div>
            {isConfirmed && cctpStatus.data ? (
              <CCTPBridgeProgress
                currentStep={cctpStatus.data.currentStep}
                isComplete={cctpStatus.data.isComplete}
                isDelayed={cctpStatus.data.isDelayed}
                estimatedTimeRemaining={cctpStatus.data.estimatedTimeRemaining}
                destinationChain={chainName}
                txHash={txHash}
              />
            ) : isBridging ? (
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
                    {status === "approving"
                      ? "Approving USDC for bridge..."
                      : "Submitting bridge transaction..."}
                  </span>
                </div>
                <p className="text-xs text-[#6B8A8D] mt-3">
                  Please confirm the transaction in your wallet.
                </p>
              </div>
            ) : (
              <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
                <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
                  How CCTP Bridging Works
                </h3>
                <div className="space-y-3">
                  {[
                    { step: "1", label: "Enter the USDC amount to bridge" },
                    { step: "2", label: "Select your destination chain" },
                    { step: "3", label: "Approve and submit the bridge transaction" },
                    { step: "4", label: "USDC is burned on Arc via CCTP" },
                    { step: "5", label: "Circle attests and mints on destination (~19 min)" },
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
                    Powered by Circle&apos;s Cross-Chain Transfer Protocol. Your USDC is
                    always safe -- if delivery fails, funds can be recovered.
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
