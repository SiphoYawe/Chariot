const rows = [
  {
    metric: "Supply APY at 20% utilisation",
    traditional: "0.18%",
    chariot: "3.60%",
    highlight: true,
  },
  {
    metric: "Idle capital strategy",
    traditional: "Earns nothing",
    chariot: "T-bill yield (~4.5%)",
    highlight: true,
  },
  {
    metric: "Risk parameter updates",
    traditional: "Governance votes (weeks)",
    chariot: "Real-time oracle data (per-block)",
    highlight: false,
  },
  {
    metric: "Crosschain collateral",
    traditional: "Not supported",
    chariot: "ETH on Ethereum accepted",
    highlight: false,
  },
  {
    metric: "Transaction finality",
    traditional: "13+ seconds (Ethereum)",
    chariot: "Sub-second (Arc)",
    highlight: false,
  },
  {
    metric: "Transaction cost",
    traditional: "$5 -- $50 (Ethereum)",
    chariot: "< $0.01 (Arc)",
    highlight: true,
  },
];

export function ComparisonSection() {
  return (
    <section id="protocol" className="py-20">
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-[#023436]">
            The math is simple.
          </h2>
        </div>
        <div className="max-w-[900px] mx-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[rgba(3,121,113,0.15)]">
                <th className="py-4 text-left text-base font-semibold text-[#3D5C5F] w-2/5">
                  Metric
                </th>
                <th className="py-4 text-left text-base font-semibold text-[#023436] w-[30%]">
                  Traditional Protocols
                </th>
                <th className="py-4 text-left text-base font-bold text-[#03B5AA] w-[30%]">
                  Chariot
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.metric}
                  className="border-b border-[rgba(3,121,113,0.15)]"
                >
                  <td className="py-4 text-base text-[#023436] font-medium">
                    {row.metric}
                  </td>
                  <td className="py-4 text-base text-[#3D5C5F] font-medium">
                    {row.traditional}
                  </td>
                  <td
                    className={`py-4 text-base font-semibold ${
                      row.highlight ? "text-[#03B5AA]" : "text-[#023436]"
                    }`}
                  >
                    {row.chariot}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
