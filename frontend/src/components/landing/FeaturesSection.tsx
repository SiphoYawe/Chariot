import { ProfitIcon, Globe02Icon, ShieldBlockchainIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const features = [
  {
    icon: ProfitIcon,
    title: "Dual-Yield Vault",
    description:
      "Earn combined APY from T-bill yield and borrower interest in a single deposit. Your USDC works harder through two revenue streams.",
  },
  {
    icon: Globe02Icon,
    title: "Crosschain Lending",
    description:
      "Deposit ETH collateral on Sepolia and borrow USDC on Arc. Seamless bridging handles the crosschain complexity for you.",
  },
  {
    icon: ShieldBlockchainIcon,
    title: "Dynamic Risk",
    description:
      "Automated risk management powered by oracle-driven rates. Dynamic LTV adjustments and liquidation parameters protect the protocol.",
  },
];

export function FeaturesSection() {
  return (
    <section className="max-w-[1200px] mx-auto px-8 py-24">
      <h2 className="text-3xl font-bold text-[#023436] text-center mb-16">
        Why Chariot
      </h2>
      <div className="grid grid-cols-3 gap-8">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="bg-white p-6 border border-[rgba(3,121,113,0.15)]"
          >
            <div className="w-10 h-10 flex items-center justify-center bg-[#F8FAFA] mb-5">
              <HugeiconsIcon
                icon={feature.icon}
                size={20}
                color="#037971"
                strokeWidth={1.5}
              />
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
    </section>
  );
}
