import Link from "next/link";

export function HeroSection() {
  return (
    <section className="pt-36 pb-20">
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="max-w-[800px] mx-auto text-center">
          <h1 className="text-[4rem] font-bold leading-[1.1] tracking-tight text-[#023436] mb-8">
            Earn yield on every dollar. Borrow against ETH without selling.
          </h1>
          <p className="text-xl leading-relaxed text-[#3D5C5F] mb-12 max-w-[640px] mx-auto">
            Chariot is a crosschain lending protocol on Arc. Lenders earn dual
            yield from borrower interest and T-bill returns -- even at low
            utilisation. Borrowers deposit ETH on Ethereum and borrow USDC on
            Arc in under two minutes.
          </p>
          <div className="flex items-center justify-center gap-4 mb-6">
            <Link
              href="/lend"
              className="inline-flex items-center justify-center h-13 px-10 text-base font-semibold text-white bg-[#03B5AA] hover:bg-[#037971] transition-colors"
            >
              Start Earning
            </Link>
            <Link
              href="/borrow"
              className="inline-flex items-center justify-center h-13 px-10 text-base font-semibold text-[#023436] border-2 border-[#023436] hover:bg-[#023436] hover:text-white transition-colors"
            >
              Start Borrowing
            </Link>
          </div>
          <p className="text-base text-[#3D5C5F]">
            Sub-second finality. Transactions under $0.01. Powered by Arc.
          </p>
        </div>
      </div>
    </section>
  );
}
