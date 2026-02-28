"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none" as const,
                userSelect: "none" as const,
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="px-5 py-2.5 text-sm font-medium bg-[#03B5AA] text-white hover:bg-[#037971] transition-colors"
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="px-5 py-2.5 text-sm font-medium bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-colors"
                  >
                    Wrong Network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-2 px-3 py-2 text-sm border border-[rgba(3,121,113,0.15)] hover:bg-[#F8FAFA] transition-colors"
                  >
                    <span className="w-2 h-2 bg-[#10B981]" />
                    <span className="text-[#023436]">{chain.name}</span>
                  </button>
                  <button
                    onClick={openAccountModal}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-[#023436] border border-[rgba(3,121,113,0.15)] hover:bg-[#F8FAFA] transition-colors min-w-[180px]"
                  >
                    <span className="w-2 h-2 bg-[#03B5AA]" />
                    <span className="font-mono tabular-nums">{account.displayName}</span>
                    {account.displayBalance && (
                      <span className="text-xs text-[#6B8A8D] ml-auto tabular-nums">
                        {account.displayBalance}
                      </span>
                    )}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
