"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ChainSelector } from "@/components/bridge/ChainSelector";
import { BridgeProgress } from "@/components/bridge/BridgeProgress";
import { NetworkBadge } from "@/components/bridge/NetworkBadge";
import { TransactionStepper, type StepConfig } from "@/components/transaction/TransactionStepper";
import { FeeBreakdown } from "@/components/transaction/FeeBreakdown";
import { useBridgeStatus } from "@/hooks/useBridgeStatus";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export default function BridgePage() {
  const [selectedChain, setSelectedChain] = useState(5042002);
  const [activeBridgeNonce, setActiveBridgeNonce] = useState<number | null>(null);
  const bridge = useBridgeStatus(activeBridgeNonce);

  // Build stepper steps from bridge state
  const getStepperSteps = (): StepConfig[] => {
    if (!bridge.data) {
      return [
        { label: "Select Chain", status: "active" },
        { label: "Initiate Bridge", status: "pending" },
        { label: "Processing", status: "pending" },
        { label: "Delivered", status: "pending" },
      ];
    }

    const stepIndex = bridge.data.stepIndex;
    return [
      { label: "Select Chain", status: "completed" },
      { label: "Initiated", status: stepIndex >= 0 ? "completed" : "pending" },
      { label: "Processing", status: stepIndex >= 1 ? (stepIndex >= 2 ? "completed" : "active") : "pending" },
      { label: "Delivered", status: bridge.data.isComplete ? "completed" : "pending" },
    ];
  };

  return (
    <div className="pb-12">
      <PageHeader title="Bridge" />

      {/* Transaction Stepper */}
      <section className="mb-8">
        <TransactionStepper steps={getStepperSteps()} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Chain selector */}
        <div className="space-y-4">
          <ChainSelector
            selectedChainId={selectedChain}
            onSelect={setSelectedChain}
          />

          {/* Selected chain info */}
          <div className="border border-[rgba(3,121,113,0.15)] bg-white p-4 flex items-center gap-3">
            <span className="text-xs text-[#6B8A8D]">Destination:</span>
            <NetworkBadge chainId={selectedChain} />
            <HugeiconsIcon icon={ArrowRight02Icon} size={16} className="text-[#6B8A8D]" />
            <span className="text-xs text-[#023436] font-medium">
              {selectedChain === 5042002 ? "Local transfer (instant)" : "Cross-chain bridge"}
            </span>
          </div>

          {/* Fee breakdown for bridge */}
          <FeeBreakdown
            gasEstimate={0.000035}
            bridgeFee={selectedChain === 5042002 ? 0 : 0.25}
            loading={false}
          />

          {/* Simulate bridge start (for demo) */}
          {!activeBridgeNonce && (
            <button
              onClick={() => setActiveBridgeNonce(Date.now())}
              className="w-full bg-[#03B5AA] text-white hover:bg-[#037971] font-medium h-11 text-sm transition-colors"
            >
              Start Bridge Demo
            </button>
          )}
        </div>

        {/* Right: Bridge progress */}
        <div>
          {bridge.data ? (
            <BridgeProgress
              currentStep={bridge.data.currentStep}
              isComplete={bridge.data.isComplete}
              isDelayed={bridge.data.isDelayed}
              estimatedTimeRemaining={bridge.data.estimatedTimeRemaining}
            />
          ) : (
            <EmptyState
              icon={ArrowRight02Icon}
              headline="No Active Bridge"
              description="Select a destination chain and start a bridge operation to track progress here."
            />
          )}
        </div>
      </div>
    </div>
  );
}
