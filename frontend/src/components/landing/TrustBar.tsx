import Image from "next/image";

const partners = [
  { name: "Arc", logo: "/logos/arc.svg", height: 28 },
  { name: "Circle CCTP", logo: "/logos/circle.svg", height: 32 },
  { name: "USYC / Hashnote", logo: "/logos/hashnote.svg", height: 32 },
  { name: "Stork Network", logo: "/logos/stork.svg", height: 20 },
  { name: "Ethereum", logo: "/logos/ethereum.svg", height: 32 },
];

export function TrustBar() {
  return (
    <section className="py-20 bg-[#F8FAFA]">
      <div className="max-w-[1200px] mx-auto px-8">
        <h2 className="text-center text-base font-semibold uppercase tracking-wider text-[#3D5C5F] mb-10">
          Built on trusted infrastructure.
        </h2>
        <div className="flex items-center justify-center gap-10 mb-10">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="flex items-center justify-center px-6 py-4 border border-[rgba(3,121,113,0.15)] bg-white min-w-[140px] h-16"
            >
              <Image
                src={partner.logo}
                alt={partner.name}
                width={100}
                height={partner.height}
                className="object-contain max-h-8"
              />
            </div>
          ))}
        </div>
        <p className="text-center text-base text-[#3D5C5F] max-w-[680px] mx-auto leading-relaxed">
          Chariot settles all transactions on Arc with sub-second deterministic
          finality. USDC moves across chains via Circle CCTP. Idle capital earns
          T-bill yield through USYC.
        </p>
      </div>
    </section>
  );
}
