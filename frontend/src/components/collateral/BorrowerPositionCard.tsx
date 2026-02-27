"use client";

import { HealthFactorGauge } from "@/components/risk/HealthFactorGauge";
import { CollateralLockStatus } from "@/components/borrow/CollateralLockStatus";
import { cn } from "@/lib/utils";

interface BorrowerPositionCardProps {
  /** Collateral amount in ETH */
  collateralAmountEth: number;
  /** Collateral market value in USDC */
  collateralValueUsdc: number;
  /** Outstanding debt in USDC */
  outstandingDebt: number;
  /** Original borrowed principal in USDC */
  principal: number;
  /** Interest accrued in USDC */
  interestAccrued: number;
  /** Effective LTV (0-1) */
  effectiveLtv: number;
  /** Health factor */
  healthFactor: number;
  /** Liquidation price (ETH) */
  liquidationPrice: number;
  /** Max additional borrow capacity in USDC */
  maxAdditionalBorrow: number;
  /** Whether user has active debt */
  hasDebt: boolean;
  /** Optional className */
  className?: string;
}

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(n: number): string {
  return (n * 100).toFixed(2) + "%";
}

function DataRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-xs text-[#6B8A8D]">{label}</span>
      <span
        className={cn(
          "text-sm font-[family-name:var(--font-heading)] tabular-nums",
          accent ? "text-[#03B5AA] font-semibold" : "text-[#023436]"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function BorrowerPositionCard({
  collateralAmountEth,
  collateralValueUsdc,
  outstandingDebt,
  principal,
  interestAccrued,
  effectiveLtv,
  healthFactor,
  liquidationPrice,
  maxAdditionalBorrow,
  hasDebt,
  className,
}: BorrowerPositionCardProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Position metrics */}
      <div className="border border-[rgba(3,121,113,0.15)] bg-white">
        <div className="p-4 border-b border-[rgba(3,121,113,0.08)]">
          <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
            Position Summary
          </h3>
        </div>
        <div className="px-4 divide-y divide-[rgba(3,121,113,0.06)]">
          <DataRow
            label="Collateral"
            value={`${collateralAmountEth.toFixed(4)} BridgedETH`}
          />
          <DataRow
            label="Market Value"
            value={`$${formatUsd(collateralValueUsdc)}`}
          />
          <DataRow
            label="Outstanding Debt"
            value={`$${formatUsd(outstandingDebt)}`}
            accent={hasDebt}
          />
          {hasDebt && (
            <>
              <DataRow
                label="Borrowed (Principal)"
                value={`$${formatUsd(principal)}`}
              />
              <DataRow
                label="Interest Accrued"
                value={`+$${formatUsd(interestAccrued)}`}
              />
            </>
          )}
          <DataRow
            label="Effective LTV"
            value={formatPercent(effectiveLtv)}
          />
          {hasDebt && (
            <DataRow
              label="Liquidation Price"
              value={`$${formatUsd(liquidationPrice)}`}
            />
          )}
          <DataRow
            label="Available to Borrow"
            value={`$${formatUsd(maxAdditionalBorrow)}`}
          />
        </div>
      </div>

      {/* Health factor gauge */}
      <HealthFactorGauge healthFactor={healthFactor} hasDebt={hasDebt} />

      {/* Collateral lock status */}
      <CollateralLockStatus hasDebt={hasDebt} outstandingDebt={outstandingDebt} />
    </div>
  );
}
