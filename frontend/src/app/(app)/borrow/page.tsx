"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { CollateralDepositFlow } from "@/components/bridge/CollateralDepositFlow";
import { CollateralTable, buildCollateralRows } from "@/components/collateral/CollateralTable";
import { HealthFactorGauge } from "@/components/risk/HealthFactorGauge";
import { DataCard } from "@/components/data/DataCard";
import { useCollateralData } from "@/hooks/useCollateralData";
import { useETHUSDPrice } from "@/hooks/useETHUSDPrice";
import { useHealthFactor } from "@/hooks/useHealthFactor";
import { useAccount } from "wagmi";
import { Wallet03Icon } from "@hugeicons/core-free-icons";
import { RISK_PARAMS } from "@chariot/shared";

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Skeleton loading state for the borrow page */
function BorrowPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border border-[rgba(3,121,113,0.15)] bg-white p-6 h-24 animate-pulse"
          >
            <div className="h-3 w-24 bg-[#F8FAFA] mb-3" />
            <div className="h-7 w-32 bg-[#F8FAFA]" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6 h-64 animate-pulse" />
        <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6 h-64 animate-pulse" />
      </div>
    </div>
  );
}

export default function BorrowPage() {
  const { address, isConnected } = useAccount();
  const collateral = useCollateralData(address);
  const ethPrice = useETHUSDPrice();
  const healthFactor = useHealthFactor(address);

  // Track whether user is in deposit flow
  const [showDepositFlow, setShowDepositFlow] = useState(false);

  // Loading state
  const isLoading = collateral.isLoading || ethPrice.isLoading;

  // Error state
  if (collateral.isError || ethPrice.isError) {
    return (
      <>
        <PageHeader title="Borrow" />
        <ErrorState
          message="Failed to load collateral data. Your funds are safe. Please try again."
          onRetry={() => {
            collateral.refetch();
            ethPrice.refetch();
          }}
        />
      </>
    );
  }

  const hasCollateral = collateral.data?.hasCollateral ?? false;
  const price = ethPrice.data?.price ?? 0;
  const collateralValue = collateral.data?.collateralValueUsdc ?? 0;
  const maxBorrow = collateralValue * RISK_PARAMS.BRIDGED_ETH.BASE_LTV;

  const collateralRows = hasCollateral && collateral.data
    ? buildCollateralRows(
        collateral.data.collateralBalance,
        collateral.data.collateralValueUsdc,
        price
      )
    : [];

  return (
    <>
      <PageHeader title="Borrow" />

      {isLoading ? (
        <BorrowPageSkeleton />
      ) : !isConnected ? (
        /* Wallet not connected */
        <EmptyState
          icon={Wallet03Icon}
          headline="Connect Wallet"
          description="Connect your wallet to deposit ETH collateral and borrow USDC."
          action={{
            label: "Connect Wallet",
            onClick: () => {
              // RainbowKit handles this via the WalletButton in header
            },
          }}
        />
      ) : !hasCollateral && !showDepositFlow ? (
        /* No collateral -- show empty state with CTA */
        <div className="space-y-6">
          {/* ETH price banner */}
          <div className="border border-[rgba(3,121,113,0.15)] bg-white p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-[#6B8A8D]">ETH/USD</span>
              <span className="text-lg font-bold text-[#023436] font-[family-name:var(--font-heading)] tabular-nums ml-3">
                ${formatUsd(price)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-[#16A34A]" style={{ borderRadius: "50%" }} />
              <span className="text-xs text-[#6B8A8D]">
                {ethPrice.data?.isStale ? "Stale" : "Live"}
              </span>
            </div>
          </div>

          <EmptyState
            icon={Wallet03Icon}
            headline="Deposit ETH to Start Borrowing"
            description="Lock ETH on Ethereum as collateral, bridge it to Arc, and borrow USDC at competitive rates. Your ETH remains safe in a smart contract escrow."
            action={{
              label: "Deposit ETH",
              onClick: () => setShowDepositFlow(true),
            }}
          />
        </div>
      ) : !hasCollateral && showDepositFlow ? (
        /* Deposit flow active */
        <div className="space-y-6">
          {/* ETH price banner */}
          <div className="border border-[rgba(3,121,113,0.15)] bg-white p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-[#6B8A8D]">ETH/USD</span>
              <span className="text-lg font-bold text-[#023436] font-[family-name:var(--font-heading)] tabular-nums ml-3">
                ${formatUsd(price)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-[#16A34A]" style={{ borderRadius: "50%" }} />
              <span className="text-xs text-[#6B8A8D]">Live</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CollateralDepositFlow
              onComplete={() => {
                setShowDepositFlow(false);
                collateral.refetch();
              }}
            />

            {/* Info panel */}
            <div className="space-y-4">
              <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
                <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
                  How It Works
                </h3>
                <div className="space-y-3">
                  {[
                    { step: "1", label: "Lock ETH on Ethereum Sepolia" },
                    { step: "2", label: "Bridge relayer mints BridgedETH on Arc" },
                    { step: "3", label: "BridgedETH deposited as collateral" },
                    { step: "4", label: "Borrow USDC up to 75% LTV" },
                  ].map(({ step, label }) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="w-5 h-5 bg-[#023436] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-white">{step}</span>
                      </div>
                      <span className="text-sm text-[#023436]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <HealthFactorGauge
                healthFactor={Infinity}
                hasDebt={false}
              />
            </div>
          </div>
        </div>
      ) : (
        /* Has collateral -- show position overview */
        <div className="space-y-6">
          {/* Metrics grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DataCard
              label="Collateral Value"
              value={`$${formatUsd(collateralValue)}`}
            />
            <DataCard
              label="Available to Borrow"
              value={`$${formatUsd(maxBorrow)}`}
              subtitle={`${(RISK_PARAMS.BRIDGED_ETH.BASE_LTV * 100).toFixed(0)}% LTV`}
            />
            <DataCard
              label="ETH/USD"
              value={`$${formatUsd(price)}`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Collateral table + deposit button */}
            <div className="space-y-4">
              <CollateralTable
                rows={collateralRows}
                isLoading={collateral.isLoading}
              />

              <Button
                onClick={() => setShowDepositFlow(true)}
                variant="outline"
                className="w-full border-[#037971] text-[#037971] hover:bg-[#037971] hover:text-white h-11 font-medium"
              >
                Deposit More ETH
              </Button>
            </div>

            {/* Right: Health factor */}
            <div className="space-y-4">
              <HealthFactorGauge
                healthFactor={healthFactor.data?.healthFactor ?? Infinity}
                hasDebt={healthFactor.data?.hasDebt ?? false}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
