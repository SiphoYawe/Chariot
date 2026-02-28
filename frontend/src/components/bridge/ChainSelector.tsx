"use client";

import { NetworkBadge, SUPPORTED_CHAINS, type ChainConfig } from "@/components/bridge/NetworkBadge";
import { cn } from "@/lib/utils";

interface ChainOption extends ChainConfig {
  estimatedTime: string;
  feePreview: string;
}

const findChain = (id: number) => SUPPORTED_CHAINS.find((c) => c.id === id)!;

const CHAIN_OPTIONS: ChainOption[] = [
  { ...findChain(5042002), estimatedTime: "Instant", feePreview: "No bridge fee" },
  { ...findChain(11155111), estimatedTime: "~15 min", feePreview: "~$2.50 gas" },
  { ...findChain(84532), estimatedTime: "~5 min", feePreview: "~$0.50 gas" },
  { ...findChain(421614), estimatedTime: "~5 min", feePreview: "~$0.30 gas" },
];

interface ChainSelectorProps {
  /** Currently selected chain ID */
  selectedChainId?: number;
  /** Callback when chain is selected */
  onSelect?: (chainId: number) => void;
  /** Chain IDs to exclude from the list */
  excludeChainIds?: number[];
  /** Optional className */
  className?: string;
}

export function ChainSelector({
  selectedChainId = 5042002,
  onSelect,
  excludeChainIds,
  className,
}: ChainSelectorProps) {
  const filteredOptions = excludeChainIds?.length
    ? CHAIN_OPTIONS.filter((c) => !excludeChainIds.includes(c.id))
    : CHAIN_OPTIONS;

  return (
    <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
      <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
        Destination Chain
      </h3>

      <div className="space-y-2" role="radiogroup" aria-label="Destination chain">
        {filteredOptions.map((chain) => {
          const isSelected = chain.id === selectedChainId;
          return (
            <button
              key={chain.id}
              role="radio"
              aria-checked={isSelected}
              aria-label={`Select ${chain.name} as destination chain`}
              onClick={() => onSelect?.(chain.id)}
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
