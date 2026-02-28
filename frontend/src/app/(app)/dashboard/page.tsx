import { PageHeader } from "@/components/layout/PageHeader";
import { ProtocolMetricsGrid } from "@/components/data/ProtocolMetricsGrid";
import { ProtocolHealthGrid } from "@/components/data/ProtocolHealthGrid";
import { YieldDisplay } from "@/components/vault/YieldDisplay";
import { BorrowRateDisplay } from "@/components/vault/BorrowRateDisplay";
import { OracleDataDisplay } from "@/components/vault/OracleDataDisplay";
import { CircuitBreakerBanner } from "@/components/feedback/CircuitBreakerBanner";
import { UtilisationBar } from "@/components/vault/UtilisationBar";
import { DashboardLenderPosition } from "@/components/collateral/DashboardLenderPosition";
import { VaultCompositionChart } from "@/components/charts/VaultCompositionChart";
import { UtilisationHistoryChart } from "@/components/charts/UtilisationHistoryChart";
import { UtilisationCurveChart } from "@/components/charts/UtilisationCurveChart";
import { ProtocolKPIGrid } from "@/components/analytics/ProtocolKPIGrid";
import { LiquidatorMonitoringTable } from "@/components/analytics/LiquidatorMonitoringTable";
import { TopBorrowersList } from "@/components/analytics/TopBorrowersList";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" />

      {/* Circuit Breaker Banner -- only visible when level > 0 */}
      <CircuitBreakerBanner />

      {/* Lender Position -- compact summary with link to Lend page */}
      <section className="mb-8">
        <DashboardLenderPosition />
      </section>

      {/* Protocol KPI Cards -- TVL, Borrowed, Positions, Revenue with spark trends */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] text-[#023436] mb-4">
          Protocol KPIs
        </h2>
        <ProtocolKPIGrid />
      </section>

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

      {/* Pool Utilisation */}
      <section className="mb-8">
        <UtilisationBar />
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

      {/* Protocol Health */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] text-[#023436] mb-4">
          Protocol Health
        </h2>
        <ProtocolHealthGrid />
      </section>

      {/* Borrower Positions & Top Positions */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)] text-[#023436] mb-4">
          Positions & Monitoring
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <LiquidatorMonitoringTable />
          </div>
          <TopBorrowersList />
        </div>
      </section>
    </div>
  );
}
