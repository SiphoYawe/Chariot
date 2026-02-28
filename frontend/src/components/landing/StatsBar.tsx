const stats = [
  { value: "20x", label: "vs Traditional Yield" },
  { value: "3.60%", label: "Current Supply Rate" },
  { value: "2", label: "Supported Networks" },
  { value: "< $0.01", label: "Average Cost" },
];

export function StatsBar() {
  return (
    <section className="bg-[#023436]">
      <div className="max-w-[1200px] mx-auto px-8 py-8 grid grid-cols-4 gap-8">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="tabular-nums text-4xl font-bold text-white mb-2">
              {stat.value}
            </p>
            <p className="text-sm font-medium uppercase tracking-wider text-white/60">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
