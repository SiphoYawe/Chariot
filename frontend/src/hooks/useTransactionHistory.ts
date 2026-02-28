"use client";

import { useState, useEffect, useCallback } from "react";
import type { Transaction } from "@/types/transaction";

// Mock transaction data -- replaced by on-chain event reads when contracts are deployed
// Will use wagmi useContractEvents to read indexed events from:
// ChariotVault (Deposit, Withdraw), LendingPool (Borrowed, Repaid),
// CollateralManager (CollateralDeposited, CollateralWithdrawn),
// LiquidationEngine (PositionLiquidated), BridgedETH (Minted, Burned)
function getMockTransactions(): Transaction[] {
  const now = Date.now();
  const hour = 3_600_000;
  const day = 24 * hour;

  return [
    {
      id: "tx-1",
      type: "deposit",
      asset: "USDC",
      amount: 5000,
      timestamp: now - 10 * 60_000,
      txHash: "0xabc123def456789012345678901234567890abcd1234567890abcdef12345678",
      blockNumber: 1_234_567,
      status: "confirmed",
    },
    {
      id: "tx-2",
      type: "borrow",
      asset: "USDC",
      amount: 2500,
      timestamp: now - 45 * 60_000,
      txHash: "0xdef456789012345678901234567890abcd1234567890abcdef12345678abc123",
      blockNumber: 1_234_550,
      status: "confirmed",
    },
    {
      id: "tx-3",
      type: "collateral_deposit",
      asset: "ETH",
      amount: 1.5,
      timestamp: now - 2 * hour,
      txHash: "0x789012345678901234567890abcd1234567890abcdef12345678abc123def456",
      blockNumber: 1_234_500,
      status: "confirmed",
    },
    {
      id: "tx-4",
      type: "bridge",
      asset: "USDC",
      amount: 1000,
      timestamp: now - 3 * hour,
      txHash: "0x012345678901234567890abcd1234567890abcdef12345678abc123def456789",
      blockNumber: 1_234_480,
      status: "pending",
    },
    {
      id: "tx-5",
      type: "deposit",
      asset: "USDC",
      amount: 10000,
      timestamp: now - day - 2 * hour,
      txHash: "0x345678901234567890abcd1234567890abcdef12345678abc123def456789012",
      blockNumber: 1_233_800,
      status: "confirmed",
    },
    {
      id: "tx-6",
      type: "repay",
      asset: "USDC",
      amount: 1200,
      timestamp: now - day - 5 * hour,
      txHash: "0x678901234567890abcd1234567890abcdef12345678abc123def456789012345",
      blockNumber: 1_233_600,
      status: "confirmed",
    },
    {
      id: "tx-7",
      type: "withdrawal",
      asset: "USDC",
      amount: 3000,
      timestamp: now - day - 8 * hour,
      txHash: "0x901234567890abcd1234567890abcdef12345678abc123def456789012345678",
      blockNumber: 1_233_400,
      status: "confirmed",
    },
    {
      id: "tx-8",
      type: "collateral_withdrawal",
      asset: "ETH",
      amount: 0.5,
      timestamp: now - 3 * day - 4 * hour,
      txHash: "0xabcd1234567890abcdef12345678abc123def456789012345678901234567890",
      blockNumber: 1_231_200,
      status: "confirmed",
    },
    {
      id: "tx-9",
      type: "liquidation",
      asset: "USDC",
      amount: 800,
      timestamp: now - 3 * day - 6 * hour,
      txHash: "0xef12345678abc123def456789012345678901234567890abcd1234567890abcd",
      blockNumber: 1_231_000,
      status: "confirmed",
    },
    {
      id: "tx-10",
      type: "deposit",
      asset: "USDC",
      amount: 20000,
      timestamp: now - 5 * day - 3 * hour,
      txHash: "0x1234567890abcdef12345678abc123def456789012345678901234567890abcd",
      blockNumber: 1_229_000,
      status: "confirmed",
    },
  ];
}

export function useTransactionHistory() {
  const [data, setData] = useState<Transaction[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      setTimeout(() => {
        if (!active) return;
        try {
          setData(getMockTransactions());
          setIsLoading(false);
        } catch {
          setIsError(true);
          setIsLoading(false);
        }
      }, 500);
    };
    load();
    const interval = setInterval(load, 12_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const refetch = useCallback(() => {
    setIsLoading(true);
    setIsError(false);
    setTimeout(() => {
      try {
        setData(getMockTransactions());
        setIsLoading(false);
      } catch {
        setIsError(true);
        setIsLoading(false);
      }
    }, 500);
  }, []);

  return { data, isLoading, isError, refetch };
}
