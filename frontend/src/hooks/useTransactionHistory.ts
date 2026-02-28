"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import {
  ChariotVaultABI,
  LendingPoolABI,
  CollateralManagerABI,
  CHARIOT_ADDRESSES,
  ARC_CHAIN_ID,
} from "@chariot/shared";
import type { Transaction } from "@/types/transaction";

// ~3 days at Arc's ~0.5s block time
const MAX_BLOCKS_BACK = BigInt(500_000);

/**
 * Case-insensitive address comparison for filtering events client-side.
 */
function addressMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Hook for fetching real on-chain transaction history from contract events.
 * Reads events from ChariotVault, LendingPool, and CollateralManager,
 * then filters client-side by the connected wallet address.
 * Always queries Arc Testnet regardless of which chain the wallet is connected to.
 */
export function useTransactionHistory() {
  const [data, setData] = useState<Transaction[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const { address } = useAccount();
  // Always use Arc Testnet client -- all Chariot contracts live on Arc
  const publicClient = usePublicClient({ chainId: ARC_CHAIN_ID });

  const fetchEvents = useCallback(async () => {
    if (!address || !publicClient) {
      setData([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock =
        currentBlock > MAX_BLOCKS_BACK
          ? currentBlock - MAX_BLOCKS_BACK
          : BigInt(0);

      // Fetch all event types in parallel -- no args filtering so the RPC
      // only needs to match by contract address + event signature (topic0).
      // Client-side filtering by wallet address is applied afterward.
      // This avoids issues with RPCs that don't support indexed topic filtering.
      const results = await Promise.allSettled([
        // Vault Deposits
        publicClient.getContractEvents({
          address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
          abi: ChariotVaultABI,
          eventName: "Deposit",
          fromBlock,
        }),
        // Vault Withdrawals
        publicClient.getContractEvents({
          address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
          abi: ChariotVaultABI,
          eventName: "Withdraw",
          fromBlock,
        }),
        // Borrows
        publicClient.getContractEvents({
          address: CHARIOT_ADDRESSES.LENDING_POOL,
          abi: LendingPoolABI,
          eventName: "Borrowed",
          fromBlock,
        }),
        // Repayments
        publicClient.getContractEvents({
          address: CHARIOT_ADDRESSES.LENDING_POOL,
          abi: LendingPoolABI,
          eventName: "Repaid",
          fromBlock,
        }),
        // Collateral Deposits
        publicClient.getContractEvents({
          address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
          abi: CollateralManagerABI,
          eventName: "CollateralDeposited",
          fromBlock,
        }),
        // Collateral Withdrawals
        publicClient.getContractEvents({
          address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
          abi: CollateralManagerABI,
          eventName: "CollateralWithdrawn",
          fromBlock,
        }),
      ]);

      // Detect when every single query failed -- surface as error
      const rejectedCount = results.filter(
        (r) => r.status === "rejected"
      ).length;
      if (rejectedCount === results.length) {
        const reasons = results.map((r) =>
          r.status === "rejected" ? r.reason : null
        );
        console.error(
          "[useTransactionHistory] All event queries failed:",
          reasons
        );
        setIsError(true);
        setIsLoading(false);
        return;
      }

      // Log individual failures for debugging without blocking
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === "rejected") {
          console.warn(
            `[useTransactionHistory] Event query ${i} failed:`,
            (results[i] as PromiseRejectedResult).reason
          );
        }
      }

      const extractLogs = <T,>(result: PromiseSettledResult<T[]>): T[] =>
        result.status === "fulfilled" ? result.value : [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type AnyLog = any;

      // Extract logs and filter client-side by wallet address
      const depositLogs = (extractLogs(results[0]) as AnyLog[]).filter(
        (log) => addressMatch(log.args?.owner, address)
      );
      const withdrawLogs = (extractLogs(results[1]) as AnyLog[]).filter(
        (log) => addressMatch(log.args?.receiver, address)
      );
      const borrowLogs = (extractLogs(results[2]) as AnyLog[]).filter(
        (log) => addressMatch(log.args?.borrower, address)
      );
      const repayLogs = (extractLogs(results[3]) as AnyLog[]).filter(
        (log) => addressMatch(log.args?.borrower, address)
      );
      const collateralDepositLogs = (
        extractLogs(results[4]) as AnyLog[]
      ).filter((log) => addressMatch(log.args?.user, address));
      const collateralWithdrawLogs = (
        extractLogs(results[5]) as AnyLog[]
      ).filter((log) => addressMatch(log.args?.user, address));

      // Collect all unique block numbers to batch-fetch timestamps
      const blockNumbers = new Set<bigint>();
      const allLogs = [
        ...depositLogs,
        ...withdrawLogs,
        ...borrowLogs,
        ...repayLogs,
        ...collateralDepositLogs,
        ...collateralWithdrawLogs,
      ] as Array<{ blockNumber: bigint | null }>;

      for (const log of allLogs) {
        if (log.blockNumber != null) blockNumbers.add(log.blockNumber);
      }

      // Fetch block timestamps in parallel (deduplicated)
      const blockTimestamps = new Map<bigint, number>();
      const blockEntries = Array.from(blockNumbers);

      if (blockEntries.length > 0) {
        const blockResults = await Promise.allSettled(
          blockEntries.map((bn) => publicClient.getBlock({ blockNumber: bn }))
        );
        for (let i = 0; i < blockEntries.length; i++) {
          const result = blockResults[i];
          if (result.status === "fulfilled") {
            blockTimestamps.set(
              blockEntries[i],
              Number(result.value.timestamp) * 1000
            );
          }
        }
      }

      const getTimestamp = (blockNumber: bigint | null): number =>
        blockNumber != null && blockTimestamps.has(blockNumber)
          ? blockTimestamps.get(blockNumber)!
          : Date.now();

      const transactions: Transaction[] = [];

      // Map deposit events
      for (const log of depositLogs) {
        transactions.push({
          id: `${log.transactionHash}-deposit`,
          type: "deposit",
          asset: "USDC",
          amount: Number(log.args?.assets ?? BigInt(0)) / 1e6,
          timestamp: getTimestamp(log.blockNumber),
          txHash: log.transactionHash ?? "",
          blockNumber: Number(log.blockNumber ?? 0),
          status: "confirmed",
        });
      }

      // Map withdrawal events
      for (const log of withdrawLogs) {
        transactions.push({
          id: `${log.transactionHash}-withdraw`,
          type: "withdrawal",
          asset: "USDC",
          amount: Number(log.args?.assets ?? BigInt(0)) / 1e6,
          timestamp: getTimestamp(log.blockNumber),
          txHash: log.transactionHash ?? "",
          blockNumber: Number(log.blockNumber ?? 0),
          status: "confirmed",
        });
      }

      // Map borrow events
      for (const log of borrowLogs) {
        transactions.push({
          id: `${log.transactionHash}-borrow`,
          type: "borrow",
          asset: "USDC",
          amount: Number(log.args?.amount ?? BigInt(0)) / 1e6,
          timestamp: getTimestamp(log.blockNumber),
          txHash: log.transactionHash ?? "",
          blockNumber: Number(log.blockNumber ?? 0),
          status: "confirmed",
        });
      }

      // Map repay events
      for (const log of repayLogs) {
        transactions.push({
          id: `${log.transactionHash}-repay`,
          type: "repay",
          asset: "USDC",
          amount: Number(log.args?.amount ?? BigInt(0)) / 1e6,
          timestamp: getTimestamp(log.blockNumber),
          txHash: log.transactionHash ?? "",
          blockNumber: Number(log.blockNumber ?? 0),
          status: "confirmed",
        });
      }

      // Map collateral deposit events
      for (const log of collateralDepositLogs) {
        transactions.push({
          id: `${log.transactionHash}-collateral_deposit`,
          type: "collateral_deposit",
          asset: "ETH",
          amount: Number(log.args?.amount ?? BigInt(0)) / 1e18,
          timestamp: getTimestamp(log.blockNumber),
          txHash: log.transactionHash ?? "",
          blockNumber: Number(log.blockNumber ?? 0),
          status: "confirmed",
        });
      }

      // Map collateral withdrawal events
      for (const log of collateralWithdrawLogs) {
        transactions.push({
          id: `${log.transactionHash}-collateral_withdrawal`,
          type: "collateral_withdrawal",
          asset: "ETH",
          amount: Number(log.args?.amount ?? BigInt(0)) / 1e18,
          timestamp: getTimestamp(log.blockNumber),
          txHash: log.transactionHash ?? "",
          blockNumber: Number(log.blockNumber ?? 0),
          status: "confirmed",
        });
      }

      // Sort by timestamp descending (most recent first)
      transactions.sort((a, b) => b.timestamp - a.timestamp);
      setData(transactions);
      setIsError(false);
      setIsLoading(false);
    } catch (err) {
      console.error("[useTransactionHistory] Failed to fetch events:", err);
      setIsError(true);
      setIsLoading(false);
    }
  }, [address, publicClient]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 30_000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    setIsError(false);
    fetchEvents();
  }, [fetchEvents]);

  return { data, isLoading, isError, refetch };
}
