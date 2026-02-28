import Link from "next/link";

export function CTABlock() {
  return (
    <section className="bg-[#023436] py-20">
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="max-w-[640px] mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Your capital is waiting.
          </h2>
          <p className="text-xl leading-relaxed text-white/70 mb-10">
            Whether you are earning dual yield as a lender or borrowing against
            ETH without selling, Chariot is your vehicle to long-term wealth.
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
              className="inline-flex items-center justify-center h-13 px-10 text-base font-semibold text-white border-2 border-white hover:bg-white hover:text-[#023436] transition-colors"
            >
              Start Borrowing
            </Link>
          </div>
          <p className="text-base text-white/50">
            No lock-ups. No minimum deposit. Sub-second transactions under
            $0.01.
          </p>
        </div>
      </div>
    </section>
  );
}
