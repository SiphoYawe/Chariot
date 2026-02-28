const partners = [
  { name: "Arc" },
  { name: "Circle CCTP" },
  { name: "USYC / Hashnote" },
  { name: "Stork Network" },
  { name: "ERC-4626" },
];

export function TrustBar() {
  return (
    <section className="py-20 bg-[#F8FAFA]">
      <div className="max-w-[1200px] mx-auto px-8">
        <h2 className="text-center text-base font-semibold uppercase tracking-wider text-[#3D5C5F] mb-10">
          Built on trusted infrastructure.
        </h2>
        <div className="flex items-center justify-center gap-6 mb-10">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="flex items-center justify-center px-6 py-3 border border-[rgba(3,121,113,0.15)] bg-white min-w-[140px]"
            >
              <span className="text-base font-semibold text-[#023436]">
                {partner.name}
              </span>
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
