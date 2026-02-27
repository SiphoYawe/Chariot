export function StatsBar() {
  const stats = [
    { label: "Total Value Locked", value: "$0.00" },
    { label: "Vault APY", value: "4.28%" },
    { label: "Chains Supported", value: "2" },
    { label: "Active Users", value: "0" },
  ];

  return (
    <section className="bg-[#023436]">
      <div className="max-w-[1200px] mx-auto px-8 py-6 flex items-center justify-between">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="tabular-nums text-2xl font-bold text-white mb-1">
              {stat.value}
            </p>
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
