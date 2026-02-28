"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useChainId } from "wagmi";
import { IconHomeFilled, IconCoinFilled, IconCreditCardFilled, IconArrowsExchange, IconClockFilled } from "@tabler/icons-react";
import { arcTestnet } from "@/lib/chains";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: IconHomeFilled },
  { href: "/lend", label: "Lend", icon: IconCoinFilled },
  { href: "/borrow", label: "Borrow", icon: IconCreditCardFilled },
  { href: "/bridge", label: "Bridge", icon: IconArrowsExchange },
  { href: "/history", label: "History", icon: IconClockFilled },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 flex flex-col bg-[#023436]">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-6">
        <Image src="/chariot-light.svg" alt="Chariot" width={110} height={25} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-[#037971] text-white border-l-[3px] border-[#03B5AA]"
                      : "text-white/80 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <item.icon size={20} color="currentColor" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer -- Wallet Status */}
      <WalletStatus />
    </aside>
  );
}

function WalletStatus() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isCorrectNetwork = chainId === arcTestnet.id;

  return (
    <div className="px-6 py-4 border-t border-white/10">
      {isConnected && address ? (
        <>
          <p className="text-sm text-white font-mono tracking-wide truncate">
            {address.slice(0, 6)}...{address.slice(-4)}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={`w-1.5 h-1.5 ${isCorrectNetwork ? "bg-[#10B981]" : "bg-[#F59E0B]"}`} />
            <p className="text-xs text-white/70">
              {isCorrectNetwork ? "Arc Testnet" : "Wrong Network"}
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-white/80">Chariot Protocol</p>
          <p className="text-xs text-white/60">Arc Testnet</p>
        </>
      )}
    </div>
  );
}
