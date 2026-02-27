const lenderSteps = [
  { number: 1, title: "Deposit USDC", description: "Supply USDC to the Chariot vault" },
  { number: 2, title: "Receive chUSDC", description: "Get vault shares representing your position" },
  { number: 3, title: "Earn Dual Yield", description: "Accrue T-bill yield + borrower interest" },
];

const borrowerSteps = [
  { number: 1, title: "Deposit ETH", description: "Lock ETH collateral on Sepolia" },
  { number: 2, title: "Bridge Collateral", description: "Collateral is bridged crosschain to Arc" },
  { number: 3, title: "Borrow USDC", description: "Draw USDC against your collateral" },
];

function StepFlow({
  title,
  steps,
}: {
  title: string;
  steps: typeof lenderSteps;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-[#023436] mb-8">{title}</h3>
      <div className="relative flex items-start gap-0">
        {steps.map((step, idx) => (
          <div key={step.number} className="flex-1 flex flex-col items-center text-center relative">
            {/* Connecting line */}
            {idx < steps.length - 1 && (
              <div className="absolute top-4 left-[calc(50%+20px)] w-[calc(100%-40px)] h-px bg-[rgba(3,121,113,0.15)]" />
            )}
            {/* Step number circle */}
            <div className="relative z-10 w-8 h-8 flex items-center justify-center bg-[#037971] text-white text-sm font-bold mb-4">
              {step.number}
            </div>
            <p className="text-sm font-semibold text-[#023436] mb-1">
              {step.title}
            </p>
            <p className="text-xs text-[#6B8A8D] leading-relaxed max-w-[160px]">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  return (
    <section className="max-w-[1200px] mx-auto px-8 py-24">
      <h2 className="text-3xl font-bold text-[#023436] text-center mb-16">
        How It Works
      </h2>
      <div className="grid grid-cols-2 gap-16">
        <StepFlow title="For Lenders" steps={lenderSteps} />
        <StepFlow title="For Borrowers" steps={borrowerSteps} />
      </div>
    </section>
  );
}
