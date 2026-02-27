"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useAccount, useChainId } from "wagmi";
import {
  Home03Icon,
  MoneyBag02Icon,
  CreditCardIcon,
  ArrowDataTransferHorizontalIcon,
  Clock04Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { arcTestnet } from "@/lib/chains";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home03Icon },
  { href: "/lend", label: "Lend", icon: MoneyBag02Icon },
  { href: "/borrow", label: "Borrow", icon: CreditCardIcon },
  { href: "/bridge", label: "Bridge", icon: ArrowDataTransferHorizontalIcon },
  { href: "/history", label: "History", icon: Clock04Icon },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 flex flex-col bg-[#023436]">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-6">
        <Image src="/chariot-dark.svg" alt="Chariot" width={140} height={32} priority />
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
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#037971] text-white border-l-[3px] border-[#03B5AA]"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <HugeiconsIcon icon={item.icon} size={20} color="currentColor" />
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
          <p className="text-xs text-white/70 font-mono truncate">
            {address.slice(0, 6)}...{address.slice(-4)}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`w-1.5 h-1.5 ${isCorrectNetwork ? "bg-[#10B981]" : "bg-[#F59E0B]"}`} />
            <p className="text-xs text-white/40">
              {isCorrectNetwork ? "Arc Testnet" : "Wrong Network"}
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-white/40">Chariot Protocol</p>
          <p className="text-xs text-white/30">Arc Testnet</p>
        </>
      )}
    </div>
  );
}
