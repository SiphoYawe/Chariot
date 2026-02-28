import Image from "next/image";
import Link from "next/link";

const navLinks = [
  { name: "Features", href: "#features" },
  { name: "How It Works", href: "#how-it-works" },
  { name: "Protocol", href: "#protocol" },
];

export function Navigation() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-[rgba(3,121,113,0.15)]">
      <div className="max-w-[1200px] mx-auto px-8 flex items-center justify-between h-16">
        <Link href="/" className="flex-shrink-0">
          <Image
            src="/chariot-dark.svg"
            alt="Chariot"
            width={120}
            height={28}
            priority
          />
        </Link>

        <nav className="flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-[15px] font-semibold text-[#3D5C5F] hover:text-[#023436] transition-colors"
            >
              {link.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/lend"
            className="inline-flex items-center justify-center h-9 px-5 text-[15px] font-semibold text-white bg-[#03B5AA] hover:bg-[#037971] transition-colors"
          >
            Start Earning
          </Link>
          <Link
            href="/borrow"
            className="inline-flex items-center justify-center h-9 px-5 text-[15px] font-semibold text-[#023436] border border-[#023436] hover:bg-[#023436] hover:text-white transition-colors"
          >
            Start Borrowing
          </Link>
        </div>
      </div>
    </header>
  );
}
