import { PageHeader } from "@/components/layout/PageHeader";
import { ProtocolMetricsGrid } from "@/components/data/ProtocolMetricsGrid";
import { YieldDisplay } from "@/components/vault/YieldDisplay";
import { BorrowRateDisplay } from "@/components/vault/BorrowRateDisplay";
import { OracleDataDisplay } from "@/components/vault/OracleDataDisplay";
import { CircuitBreakerBanner } from "@/components/feedback/CircuitBreakerBanner";
import { VaultCompositionChart } from "@/components/charts/VaultCompositionChart";
import { UtilisationHistoryChart } from "@/components/charts/UtilisationHistoryChart";
import { UtilisationCurveChart } from "@/components/charts/UtilisationCurveChart";
import { ProtocolKPIGrid } from "@/components/analytics/ProtocolKPIGrid";
import { ActivityPulseHeatmap } from "@/components/charts/ActivityPulseHeatmap";
import { APYWaterfallChart } from "@/components/charts/APYWaterfallChart";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" />

      {/* Circuit Breaker Banner -- only visible when level > 0 */}
      <CircuitBreakerBanner />

      {/* Protocol KPI Cards -- TVL, Borrowed, Positions, Revenue with spark trends */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] text-[#023436] mb-4">
          Protocol KPIs
        </h2>
        <ProtocolKPIGrid />
      </section>

      {/* Protocol Activity Heatmap */}
      <section className="mb-8">
        <ActivityPulseHeatmap />
      </section>

      {/* Protocol Metrics */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] text-[#023436] mb-4">
          Protocol Overview
        </h2>
        <ProtocolMetricsGrid />
      </section>

      {/* Yield & Rate Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <YieldDisplay />
        <BorrowRateDisplay />
        <APYWaterfallChart />
      </section>

      {/* Vault Composition & Utilisation History Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <VaultCompositionChart />
        <UtilisationHistoryChart />
      </section>

      {/* Interactive Rate Curve */}
      <section className="mb-8">
        <UtilisationCurveChart />
      </section>

      {/* Oracle Data */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] text-[#023436] mb-4">
          Oracle Data
        </h2>
        <OracleDataDisplay />
      </section>
    </div>
  );
}
