"use client";

import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataCard } from "@/components/data/DataCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/transaction/AmountInput";
import {
  TransactionPreview,
  type PreviewRow,
} from "@/components/transaction/TransactionPreview";
import { ApprovalStep, type ApprovalState } from "@/components/transaction/ApprovalStep";
import { TransactionConfirmation } from "@/components/feedback/TransactionConfirmation";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useVaultMetrics } from "@/hooks/useVaultMetrics";
import { useVaultDeposit } from "@/hooks/useVaultDeposit";
import { useVaultWithdraw } from "@/hooks/useVaultWithdraw";
import { PositionCard } from "@/components/collateral/PositionCard";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useLenderPosition } from "@/hooks/useLenderPosition";
import { Loading03Icon, CoinsSwapIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

// -- Mock user balances (replaced by wagmi useReadContract when deployed) --
const MOCK_USDC_BALANCE = "10,000.00";
const MOCK_USDC_BALANCE_RAW = 10_000;
const MOCK_CHUSDC_BALANCE = "5,000.00";
const MOCK_CHUSDC_BALANCE_RAW = 5_000;

// ============================================================
// Vault Stats Bar
// ============================================================

function VaultStats() {
  const { data, isLoading, isError, refetch } = useVaultMetrics();

  if (isError) {
    return <ErrorState message="Unable to load vault stats. Click retry to try again." onRetry={refetch} />;
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <DataCard
        label="Supply APY"
        value={data ? `${data.supplyAPY.toFixed(2)}%` : ""}
        subtitle="T-Bill + Borrow Interest"
        loading={isLoading}
        accent
      />
      <DataCard
        label="Total Vault TVL"
        value={data ? `$${data.totalAssets.toLocaleString()}` : ""}
        subtitle="All deposits"
        loading={isLoading}
      />
      <DataCard
        label="Utilisation"
        value={data ? `${data.utilisationRate.toFixed(1)}%` : ""}
        subtitle="Capital deployed to borrowers"
        loading={isLoading}
      />
    </div>
  );
}

// ============================================================
// Deposit Panel
// ============================================================

function DepositPanel() {
  const [amount, setAmount] = useState("");
  const { data: metrics, isLoading: metricsLoading } = useVaultMetrics();
  const {
    status,
    txHash,
    errorMessage,
    needsApproval,
    approve,
    deposit,
    reset,
  } = useVaultDeposit();

  const parsedAmount = parseFloat(amount) || 0;

  // Validation
  const validationError = useMemo(() => {
    if (!amount || parsedAmount === 0) return undefined;
    if (parsedAmount > MOCK_USDC_BALANCE_RAW) return "Insufficient USDC balance";
    return undefined;
  }, [amount, parsedAmount]);

  const canDeposit =
    parsedAmount > 0 && !validationError && !needsApproval;

  // Preview rows
  const previewRows: PreviewRow[] = useMemo(() => {
    if (parsedAmount <= 0) return [];
    const sharePrice = metrics?.sharePrice ?? 1.0;
    const sharesToReceive = parsedAmount / sharePrice;
    const apy = metrics?.supplyAPY ?? 0;
    const estimatedEarnings = parsedAmount * (apy / 100);
    const tbillComponent = metrics?.tbillYieldComponent ?? 0;
    const borrowComponent = metrics?.borrowInterestComponent ?? 0;

    return [
      {
        label: "chUSDC to receive",
        value: sharesToReceive.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        bold: true,
      },
      {
        label: "Share price",
        value: `$${sharePrice.toFixed(6)}`,
        tooltip: "1 chUSDC represents this much USDC in the vault",
      },
      {
        label: "Est. annual earnings",
        value: `$${estimatedEarnings.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        accent: true,
        separator: true,
        tooltip:
          "Estimated based on current APY. Actual earnings depend on utilisation and USYC yield",
      },
      {
        label: "T-Bill yield",
        value: `${tbillComponent.toFixed(2)}%`,
        tooltip:
          "Yield from idle USDC deployed into T-Bill-backed USYC tokens (minus 5% strategy fee)",
      },
      {
        label: "Borrow interest",
        value: `${borrowComponent.toFixed(2)}%`,
        tooltip:
          "Interest earned from USDC lent to borrowers (minus 10% reserve factor)",
      },
    ];
  }, [parsedAmount, metrics]);

  // Approval state mapping
  const approvalState: ApprovalState = useMemo(() => {
    if (status === "approving") return "approving";
    if (!needsApproval) return "approved";
    return "needs_approval";
  }, [status, needsApproval]);

  const handleDeposit = useCallback(async () => {
    await deposit(amount);
  }, [deposit, amount]);

  // -- Confirmed state --
  if (status === "confirmed" && txHash) {
    return (
      <TransactionConfirmation
        txHash={txHash}
        title="Deposit Confirmed"
        details={[
          { label: "Deposited", value: `${parsedAmount.toLocaleString()} USDC` },
          {
            label: "Received",
            value: `${(parsedAmount / (metrics?.sharePrice ?? 1)).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} chUSDC`,
          },
        ]}
        primaryAction={{ label: "Deposit More", onClick: () => { reset(); setAmount(""); } }}
      />
    );
  }

  // -- Error state --
  if (status === "error" && errorMessage) {
    return (
      <ErrorState
        message={errorMessage}
        onRetry={() => {
          reset();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <AmountInput
        value={amount}
        onChange={setAmount}
        tokenSymbol="USDC"
        balance={MOCK_USDC_BALANCE}
        decimals={2}
        error={validationError}
        disabled={status === "depositing"}
        usdValue={parsedAmount > 0 ? `$${parsedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined}
      />

      <TransactionPreview
        title="Deposit Preview"
        rows={previewRows}
        loading={metricsLoading && parsedAmount > 0}
      />

      {/* Approval step (only when amount > 0) */}
      {parsedAmount > 0 && !validationError && needsApproval && (
        <ApprovalStep
          state={approvalState}
          tokenSymbol="USDC"
          onApprove={approve}
          disabled={status === "approving"}
        />
      )}

      {/* Deposit button */}
      <Button
        onClick={handleDeposit}
        disabled={!canDeposit || status === "depositing"}
        className="w-full h-12 bg-[#03B5AA] text-white text-base font-semibold hover:bg-[#037971] disabled:bg-[#9CA3AF] disabled:text-white/60"
      >
        {status === "depositing" ? (
          <span className="flex items-center gap-2">
            <HugeiconsIcon icon={Loading03Icon} size={18} className="animate-spin" />
            Depositing...
          </span>
        ) : (
          "Deposit"
        )}
      </Button>
    </div>
  );
}

// ============================================================
// Withdraw Panel
// ============================================================

function WithdrawPanel() {
  const [amount, setAmount] = useState("");
  const [denomination, setDenomination] = useState<"usdc" | "chusdc">("usdc");
  const { data: metrics, isLoading: metricsLoading } = useVaultMetrics();
  const { status, txHash, errorMessage, withdraw, reset } = useVaultWithdraw();

  const parsedAmount = parseFloat(amount) || 0;
  const sharePrice = metrics?.sharePrice ?? 1.0;

  // Convert between denominations for display
  const usdcAmount =
    denomination === "usdc" ? parsedAmount : parsedAmount * sharePrice;
  const chUsdcAmount =
    denomination === "chusdc" ? parsedAmount : parsedAmount / sharePrice;

  const maxBalance =
    denomination === "usdc" ? MOCK_CHUSDC_BALANCE_RAW * sharePrice : MOCK_CHUSDC_BALANCE_RAW;
  const balanceDisplay =
    denomination === "usdc"
      ? (MOCK_CHUSDC_BALANCE_RAW * sharePrice).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : MOCK_CHUSDC_BALANCE;

  // Validation
  const validationError = useMemo(() => {
    if (!amount || parsedAmount === 0) return undefined;
    if (parsedAmount > maxBalance) {
      return denomination === "usdc"
        ? "Insufficient vault balance"
        : "Insufficient chUSDC balance";
    }
    return undefined;
  }, [amount, parsedAmount, maxBalance, denomination]);

  const canWithdraw = parsedAmount > 0 && !validationError;

  // Preview rows
  const previewRows: PreviewRow[] = useMemo(() => {
    if (parsedAmount <= 0) return [];

    return [
      {
        label: denomination === "usdc" ? "chUSDC to burn" : "USDC to receive",
        value:
          denomination === "usdc"
            ? chUsdcAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : usdcAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
        bold: true,
      },
      {
        label: "Share price",
        value: `$${sharePrice.toFixed(6)}`,
        tooltip: "Current value of 1 chUSDC in USDC",
      },
      {
        label: "Yield earned",
        value: "$0.00",
        accent: true,
        separator: true,
        tooltip:
          "Yield is automatically reflected in the share price. Your chUSDC is worth more USDC over time.",
      },
    ];
  }, [parsedAmount, denomination, chUsdcAmount, usdcAmount, sharePrice]);

  const handleWithdraw = useCallback(async () => {
    const withdrawAmount =
      denomination === "usdc" ? amount : usdcAmount.toFixed(2);
    await withdraw(withdrawAmount);
  }, [withdraw, amount, denomination, usdcAmount]);

  // -- Confirmed state --
  if (status === "confirmed" && txHash) {
    return (
      <TransactionConfirmation
        txHash={txHash}
        title="Withdrawal Confirmed"
        details={[
          {
            label: "Received",
            value: `${usdcAmount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} USDC`,
          },
          {
            label: "Burned",
            value: `${chUsdcAmount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} chUSDC`,
          },
        ]}
        primaryAction={{
          label: "Withdraw More",
          onClick: () => {
            reset();
            setAmount("");
          },
        }}
      />
    );
  }

  // -- Error state --
  if (status === "error" && errorMessage) {
    return <ErrorState message={errorMessage} onRetry={reset} />;
  }

  return (
    <div className="space-y-4">
      {/* Denomination toggle */}
      <div className="flex gap-1 p-1 bg-[#F8FAFA] border border-[rgba(3,121,113,0.15)] w-fit">
        <button
          onClick={() => {
            setDenomination("usdc");
            setAmount("");
          }}
          className={`px-3 py-1 text-xs font-medium transition-colors ${
            denomination === "usdc"
              ? "bg-white text-[#023436] border border-[rgba(3,121,113,0.15)]"
              : "text-[#6B8A8D] hover:text-[#023436]"
          }`}
        >
          USDC
        </button>
        <button
          onClick={() => {
            setDenomination("chusdc");
            setAmount("");
          }}
          className={`px-3 py-1 text-xs font-medium transition-colors ${
            denomination === "chusdc"
              ? "bg-white text-[#023436] border border-[rgba(3,121,113,0.15)]"
              : "text-[#6B8A8D] hover:text-[#023436]"
          }`}
        >
          chUSDC
        </button>
      </div>

      <AmountInput
        value={amount}
        onChange={setAmount}
        tokenSymbol={denomination === "usdc" ? "USDC" : "chUSDC"}
        balance={balanceDisplay}
        decimals={denomination === "usdc" ? 2 : 6}
        error={validationError}
        disabled={status === "withdrawing"}
        usdValue={
          usdcAmount > 0
            ? `$${usdcAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : undefined
        }
      />

      <TransactionPreview
        title="Withdrawal Preview"
        rows={previewRows}
        loading={metricsLoading && parsedAmount > 0}
      />

      <Button
        onClick={handleWithdraw}
        disabled={!canWithdraw || status === "withdrawing"}
        className="w-full h-12 bg-[#03B5AA] text-white text-base font-semibold hover:bg-[#037971] disabled:bg-[#9CA3AF] disabled:text-white/60"
      >
        {status === "withdrawing" ? (
          <span className="flex items-center gap-2">
            <HugeiconsIcon icon={Loading03Icon} size={18} className="animate-spin" />
            Withdrawing...
          </span>
        ) : (
          "Withdraw"
        )}
      </Button>
    </div>
  );
}

// ============================================================
// Lender Position Section
// ============================================================

function LenderPositionSection() {
  const { data, isLoading, hasPosition } = useLenderPosition();

  if (isLoading) {
    return (
      <PositionCard
        shareBalance={0}
        sharePrice={0}
        positionValue={0}
        originalDeposit={0}
        accruedEarnings={0}
        personalAPY={0}
        loading
      />
    );
  }

  if (!hasPosition || !data) {
    return (
      <EmptyState
        icon={CoinsSwapIcon}
        headline="Start Earning"
        description="Deposit USDC to earn dual yield from T-Bill-backed USYC tokens and borrower interest. Your deposits are represented as chUSDC shares that appreciate over time."
        action={{
          label: "Deposit USDC",
          onClick: () => {
            const depositTab = document.querySelector(
              '[data-slot="tabs-trigger"][value="deposit"]'
            ) as HTMLElement;
            depositTab?.click();
          },
        }}
      />
    );
  }

  return (
    <PositionCard
      shareBalance={data.shareBalance}
      sharePrice={data.sharePrice}
      positionValue={data.positionValue}
      originalDeposit={data.originalDeposit}
      accruedEarnings={data.accruedEarnings}
      personalAPY={data.personalAPY}
    />
  );
}

// ============================================================
// Lend Page
// ============================================================

export default function LendPage() {
  return (
    <div className="pb-12">
      <PageHeader title="Lend" />

      {/* Vault stats summary */}
      <section className="mb-8">
        <VaultStats />
      </section>

      {/* Lender position or empty state */}
      <section className="mb-8 max-w-[520px]">
        <LenderPositionSection />
      </section>

      {/* Deposit / Withdraw tabs */}
      <section className="max-w-[520px]">
        <Tabs defaultValue="deposit">
          <TabsList
            variant="line"
            className="w-full border-b border-[rgba(3,121,113,0.15)] mb-6"
          >
            <TabsTrigger
              value="deposit"
              className="px-6 pb-3 text-sm font-medium data-[state=active]:text-[#03B5AA] data-[state=inactive]:text-[#6B8A8D]"
            >
              Deposit
            </TabsTrigger>
            <TabsTrigger
              value="withdraw"
              className="px-6 pb-3 text-sm font-medium data-[state=active]:text-[#03B5AA] data-[state=inactive]:text-[#6B8A8D]"
            >
              Withdraw
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deposit">
            <DepositPanel />
          </TabsContent>

          <TabsContent value="withdraw">
            <WithdrawPanel />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
