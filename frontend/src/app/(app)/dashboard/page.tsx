import { PageHeader } from "@/components/layout/PageHeader";
import { YieldDisplay } from "@/components/vault/YieldDisplay";
import { BorrowRateDisplay } from "@/components/vault/BorrowRateDisplay";
import { CircuitBreakerBanner } from "@/components/feedback/CircuitBreakerBanner";
import { UtilisationHistoryChart } from "@/components/charts/UtilisationHistoryChart";
import { UtilisationCurveChart } from "@/components/charts/UtilisationCurveChart";
import { ProtocolKPIGrid } from "@/components/analytics/ProtocolKPIGrid";
import { APYWaterfallChart } from "@/components/charts/APYWaterfallChart";
import { VaultCompositionChart } from "@/components/charts/VaultCompositionChart";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" />

      {/* Circuit Breaker Banner -- only visible when level > 0 */}
      <CircuitBreakerBanner />

      {/* Protocol KPIs -- TVL, Borrowed, Idle, Utilisation with spark trends */}
      <section className="mb-8">
        <ProtocolKPIGrid />
      </section>

      {/* Yield & Rate Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <YieldDisplay />
        <BorrowRateDisplay />
        <APYWaterfallChart />
      </section>

      {/* Vault Allocation & Utilisation History */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <VaultCompositionChart />
        <UtilisationHistoryChart />
      </section>

      {/* Interactive Rate Curve */}
      <section className="mb-8">
        <UtilisationCurveChart />
      </section>
    </div>
  );
}
