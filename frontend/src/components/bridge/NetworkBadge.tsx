"use client";

import { cn } from "@/lib/utils";

export interface ChainConfig {
  id: number;
  name: string;
  icon: string;
  color: string;
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
  { id: 5042002, name: "Arc", icon: "A", color: "#03B5AA" },
  { id: 11155111, name: "Ethereum", icon: "E", color: "#627EEA" },
  { id: 84532, name: "Base", icon: "B", color: "#0052FF" },
  { id: 421614, name: "Arbitrum", icon: "R", color: "#28A0F0" },
];

interface NetworkBadgeProps {
  /** Chain ID or chain name */
  chainId: number;
  /** Compact variant for inline use */
  compact?: boolean;
  /** Optional className */
  className?: string;
}

export function NetworkBadge({ chainId, compact, className }: NetworkBadgeProps) {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  if (!chain) return null;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium",
          className
        )}
        style={{ color: chain.color }}
      >
        <span
          className="w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold text-white"
          style={{ backgroundColor: chain.color }}
        >
          {chain.icon}
        </span>
        {chain.name}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 border text-sm font-medium",
        className
      )}
      style={{
        borderColor: `${chain.color}30`,
        color: chain.color,
        backgroundColor: `${chain.color}08`,
      }}
    >
      <span
        className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white"
        style={{ backgroundColor: chain.color }}
      >
        {chain.icon}
      </span>
      {chain.name}
    </span>
  );
}
