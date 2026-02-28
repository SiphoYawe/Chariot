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
        <div className="flex items-center justify-center gap-12">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="flex items-center justify-center px-8 py-6 border border-[rgba(3,121,113,0.15)] bg-white min-w-[180px] h-24"
            >
              <Image
                src={partner.logo}
                alt={partner.name}
                width={140}
                height={partner.height}
                className="object-contain max-h-14"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
