"use client";

import { useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { arcTestnet } from "@/lib/chains";
import { IconAlertTriangleFilled, IconChevronDown, IconChevronUp } from "@tabler/icons-react";

export function NetworkSwitchPrompt() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const [showManual, setShowManual] = useState(false);

  if (!isConnected || chainId === arcTestnet.id) return null;

  return (
    <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconAlertTriangleFilled size={20} className="text-[#F59E0B]" />
          <div>
            <p className="text-sm font-medium text-[#023436]">Wrong Network</p>
            <p className="text-xs text-[#6B8A8D]">Please switch to Arc Testnet to use Chariot</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => switchChain({ chainId: arcTestnet.id })}
            className="px-3 py-1.5 text-sm font-medium bg-[#03B5AA] text-white hover:bg-[#037971] transition-colors"
          >
            Switch Network
          </button>
          <button
            onClick={() => setShowManual(!showManual)}
            className="px-2 py-1.5 text-xs text-[#6B8A8D] hover:text-[#023436] transition-colors flex items-center gap-1"
          >
            Manual
            {showManual ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          </button>
        </div>
      </div>
      {showManual && (
        <div className="mt-3 pt-3 border-t border-[#F59E0B]/20">
          <p className="text-xs font-medium text-[#023436] mb-2">Add Arc Testnet manually:</p>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-[#6B8A8D]">Chain ID</p>
              <p className="font-mono font-medium text-[#023436] mt-0.5">5042002</p>
            </div>
            <div>
              <p className="text-[#6B8A8D]">RPC URL</p>
              <p className="font-mono font-medium text-[#023436] mt-0.5 break-all">
                {arcTestnet.rpcUrls.default.http[0]}
              </p>
            </div>
            <div>
              <p className="text-[#6B8A8D]">Currency Symbol</p>
              <p className="font-mono font-medium text-[#023436] mt-0.5">USDC</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
