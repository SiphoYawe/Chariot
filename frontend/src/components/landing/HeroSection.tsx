import Link from "next/link";

export function HeroSection() {
  return (
    <section className="max-w-[1200px] mx-auto px-8 pt-20 pb-24">
      <div className="max-w-[720px] mx-auto text-center">
        <h1 className="text-5xl font-bold leading-[1.15] tracking-tight text-[#023436] mb-6">
          Institutional-Grade
          <br />
          Crosschain Lending
        </h1>
        <p className="text-lg leading-relaxed text-[#6B8A8D] mb-12 max-w-[560px] mx-auto">
          Dual-yield vault for lenders combining T-bill and borrower interest.
          Collateral flexibility for borrowers across chains.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/lend"
            className="inline-flex items-center justify-center h-12 px-8 text-sm font-semibold text-white bg-[#03B5AA] hover:bg-[#037971] transition-colors"
          >
            Start Earning
          </Link>
          <Link
            href="/borrow"
            className="inline-flex items-center justify-center h-12 px-8 text-sm font-semibold text-[#03B5AA] border border-[#03B5AA] hover:bg-[#03B5AA] hover:text-white transition-colors"
          >
            Start Borrowing
          </Link>
        </div>
      </div>
    </section>
  );
}
