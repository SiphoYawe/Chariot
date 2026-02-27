import { PageHeader } from "@/components/layout/PageHeader";
import { ProtocolMetricsGrid } from "@/components/data/ProtocolMetricsGrid";
import { ProtocolHealthGrid } from "@/components/data/ProtocolHealthGrid";
import { YieldDisplay } from "@/components/vault/YieldDisplay";
import { BorrowRateDisplay } from "@/components/vault/BorrowRateDisplay";
import { OracleDataDisplay } from "@/components/vault/OracleDataDisplay";
import { CircuitBreakerBanner } from "@/components/feedback/CircuitBreakerBanner";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" />

      {/* Circuit Breaker Banner -- only visible when level > 0 */}
      <CircuitBreakerBanner />

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

      {/* Oracle Data */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] text-[#023436] mb-4">
          Oracle Data
        </h2>
        <OracleDataDisplay />
      </section>

      {/* Protocol Health */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] text-[#023436] mb-4">
          Protocol Health
        </h2>
        <ProtocolHealthGrid />
      </section>
    </div>
  );
}
