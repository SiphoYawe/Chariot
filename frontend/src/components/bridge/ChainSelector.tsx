"use client";

import { useState } from "react";
import { NetworkBadge, SUPPORTED_CHAINS, type ChainConfig } from "@/components/bridge/NetworkBadge";
import { cn } from "@/lib/utils";

interface ChainOption extends ChainConfig {
  estimatedTime: string;
  feePreview: string;
}

const CHAIN_OPTIONS: ChainOption[] = [
  { ...SUPPORTED_CHAINS[0], estimatedTime: "Instant", feePreview: "No bridge fee" },
  { ...SUPPORTED_CHAINS[1], estimatedTime: "~15 min", feePreview: "~$2.50 gas" },
  { ...SUPPORTED_CHAINS[2], estimatedTime: "~5 min", feePreview: "~$0.50 gas" },
  { ...SUPPORTED_CHAINS[3], estimatedTime: "~5 min", feePreview: "~$0.30 gas" },
];

interface ChainSelectorProps {
  /** Currently selected chain ID */
  selectedChainId?: number;
  /** Callback when chain is selected */
  onSelect?: (chainId: number) => void;
  /** Optional className */
  className?: string;
}

export function ChainSelector({
  selectedChainId = 5042002,
  onSelect,
  className,
}: ChainSelectorProps) {
  const [selected, setSelected] = useState(selectedChainId);

  const handleSelect = (chainId: number) => {
    setSelected(chainId);
    onSelect?.(chainId);
  };

  return (
    <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
      <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
        Destination Chain
      </h3>

      <div className="space-y-2">
        {CHAIN_OPTIONS.map((chain) => {
          const isSelected = chain.id === selected;
          return (
            <button
              key={chain.id}
              onClick={() => handleSelect(chain.id)}
              className={cn(
                "w-full flex items-center justify-between p-3 border transition-colors text-left",
                isSelected
                  ? "border-[#03B5AA] bg-[rgba(3,181,170,0.05)]"
                  : "border-[rgba(3,121,113,0.15)] hover:border-[rgba(3,121,113,0.30)]"
              )}
            >
              <div className="flex items-center gap-3">
                <NetworkBadge chainId={chain.id} compact />
              </div>

              <div className="flex items-center gap-4 text-right">
                <span className="text-xs text-[#6B8A8D] tabular-nums font-[family-name:var(--font-heading)]">
                  {chain.estimatedTime}
                </span>
                <span className="text-xs text-[#9CA3AF] tabular-nums font-[family-name:var(--font-heading)]">
                  {chain.feePreview}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
