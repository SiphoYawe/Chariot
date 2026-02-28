import {
  IconShieldLockFilled,
  IconArrowsExchange,
  IconShieldCheckFilled,
} from "@tabler/icons-react";

const features = [
  {
    icon: IconShieldLockFilled,
    title: "Dual-Yield Vault",
    description:
      "Your USDC earns from two sources at once -- borrower interest payments and T-bill returns on idle capital via USYC. At 20% pool utilisation, Chariot delivers 3.60% APY. Traditional protocols deliver 0.18%.",
  },
  {
    icon: IconArrowsExchange,
    title: "Crosschain Lending",
    description:
      "Deposit ETH on Ethereum. Borrow USDC on Arc. Chariot bridges your collateral through a custom escrow system so you can access liquidity across chains without selling your position.",
  },
  {
    icon: IconShieldCheckFilled,
    title: "Dynamic Risk Engine",
    description:
      "LTV ratios and interest rates adjust based on real-time oracle data. When volatility spikes, your position is protected automatically. When markets calm, you get more capacity. No governance votes. No delays.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20">
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-[#023436] mb-4">
            Built for both sides of the market.
          </h2>
          <p className="text-lg text-[#6B8A8D] max-w-[600px] mx-auto">
            Three mechanisms working together so lenders never earn zero and
            borrowers never overpay.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-white p-8 border border-[rgba(3,121,113,0.15)]"
            >
              <div className="w-12 h-12 flex items-center justify-center bg-[#F8FAFA] mb-6">
                <feature.icon size={24} className="text-[#037971]" />
              </div>
              <h3 className="text-lg font-semibold text-[#023436] mb-3">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-[#6B8A8D]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
