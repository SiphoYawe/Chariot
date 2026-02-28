import Image from "next/image";
import Link from "next/link";

const protocolLinks = [
  { name: "Documentation", href: "#" },
  { name: "Smart Contracts", href: "#" },
  { name: "GitHub", href: "#" },
];

const productLinks = [
  { name: "Lend", href: "/lend" },
  { name: "Borrow", href: "/borrow" },
  { name: "Bridge", href: "/bridge" },
];

const communityLinks = [
  { name: "Twitter / X", href: "#" },
  { name: "Discord", href: "#" },
];

export function FooterSection() {
  return (
    <footer className="bg-[#023436] border-t border-white/10 py-16">
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="grid grid-cols-4 gap-12 mb-12">
          <div>
            <Image
              src="/chariot-light.svg"
              alt="Chariot"
              width={120}
              height={28}
              className="mb-4"
            />
            <p className="text-sm text-white/40">
              Crosschain collateral lending on Arc.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-4">
              Protocol
            </p>
            <ul className="space-y-3">
              {protocolLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/40 hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-4">
              Product
            </p>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/40 hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-4">
              Community
            </p>
            <ul className="space-y-3">
              {communityLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/40 hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex items-center justify-between">
          <p className="text-xs text-white/30">
            &copy; 2026 Chariot. All rights reserved.
          </p>
          <p className="text-xs text-white/30">Built on Arc.</p>
        </div>
      </div>
    </footer>
  );
}
