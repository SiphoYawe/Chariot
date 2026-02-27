import { PageHeader } from "@/components/layout/PageHeader";
import { ProtocolMetricsGrid } from "@/components/data/ProtocolMetricsGrid";
import { YieldDisplay } from "@/components/vault/YieldDisplay";
import { BorrowRateDisplay } from "@/components/vault/BorrowRateDisplay";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" />

      {/* Protocol Metrics */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] text-[#023436] mb-4">
          Protocol Overview
        </h2>
        <ProtocolMetricsGrid />
      </section>

      {/* Yield & Rate Section */}
      <section className="grid grid-cols-2 gap-6 mb-8">
        <YieldDisplay />
        <BorrowRateDisplay />
      </section>
    </div>
  );
}
