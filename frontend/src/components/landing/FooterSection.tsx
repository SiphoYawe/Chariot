import Image from "next/image";
import Link from "next/link";

const productLinks = [
  { name: "Lend", href: "/lend" },
  { name: "Borrow", href: "/borrow" },
  { name: "Bridge", href: "/bridge" },
];

export function FooterSection() {
  return (
    <footer className="bg-[#023436] border-t border-white/10 py-16">
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="grid grid-cols-2 gap-12 mb-12">
          <div>
            <Image
              src="/chariot-light.svg"
              alt="Chariot"
              width={120}
              height={28}
              className="mb-4"
            />
            <p className="text-base text-white/60">
              Crosschain collateral lending on Arc.
            </p>
          </div>

          <div>
            <p className="text-sm font-bold text-white/80 uppercase tracking-wider mb-4">
              Product
            </p>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-base text-white/60 hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex items-center justify-between">
          <p className="text-sm text-white/50">
            &copy; 2026 Chariot. All rights reserved.
          </p>
          <p className="text-sm text-white/50">Built on Arc.</p>
        </div>
      </div>
    </footer>
  );
}
