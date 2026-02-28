const lenderSteps = [
  {
    number: 1,
    title: "Deposit USDC",
    description:
      "Connect your wallet and deposit USDC into the Chariot Vault. You receive chUSDC vault shares representing your position.",
  },
  {
    number: 2,
    title: "Earn Dual Yield",
    description:
      "Your deposit earns from two sources simultaneously -- borrower interest and T-bill returns on idle capital. Yield accrues to your vault shares in real time.",
  },
  {
    number: 3,
    title: "Withdraw Anytime",
    description:
      "Redeem your chUSDC shares for USDC plus all accrued earnings. No lock-ups. No penalties. Your capital, your timeline.",
  },
];

const borrowerSteps = [
  {
    number: 1,
    title: "Deposit ETH on Ethereum",
    description:
      "Deposit ETH into the Chariot escrow contract on Ethereum. Your collateral is securely locked and bridged to Arc within seconds.",
  },
  {
    number: 2,
    title: "Collateral Arrives on Arc",
    description:
      "The bridge relayer confirms your deposit and mints BridgedETH on Arc. Your collateral value, health factor, and borrow capacity appear instantly.",
  },
  {
    number: 3,
    title: "Borrow USDC",
    description:
      "Borrow USDC against your collateral on Arc with sub-second finality. Repay on your own schedule -- no deadlines, no penalties for early repayment.",
  },
];

function StepFlow({
  label,
  steps,
}: {
  label: string;
  steps: typeof lenderSteps;
}) {
  return (
    <div>
      <p className="text-base font-semibold text-[#03B5AA] uppercase tracking-wider mb-8">
        {label}
      </p>
      <div className="relative space-y-8">
        <div className="absolute left-5 top-10 bottom-5 w-px bg-[rgba(3,121,113,0.15)]" />
        {steps.map((step) => (
          <div key={step.number} className="flex gap-6 relative">
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-[#037971] text-white text-base font-bold relative z-10">
              {step.number}
            </div>
            <div className="pt-1">
              <h4 className="text-lg font-semibold text-[#023436] mb-2">
                {step.title}
              </h4>
              <p className="text-base leading-relaxed text-[#3D5C5F]">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 bg-[#F8FAFA]">
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-[#023436] mb-4">
            How Chariot works.
          </h2>
          <p className="text-xl text-[#3D5C5F]">
            Two paths. Both take under two minutes.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-20">
          <StepFlow label="For Lenders" steps={lenderSteps} />
          <StepFlow label="For Borrowers" steps={borrowerSteps} />
        </div>
      </div>
    </section>
  );
}
