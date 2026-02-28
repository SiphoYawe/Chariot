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

const MAX_BLOCKS_BACK = BigInt(50_000);

/**
 * Hook for fetching real on-chain transaction history from contract events.
 * Reads indexed events from ChariotVault, LendingPool, and CollateralManager.
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
      const fromBlock = currentBlock > MAX_BLOCKS_BACK ? currentBlock - MAX_BLOCKS_BACK : BigInt(0);

      // Fetch all event types in parallel
      const results = await Promise.allSettled([
        // Vault Deposits
        publicClient.getContractEvents({
          address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
          abi: ChariotVaultABI,
          eventName: "Deposit",
          args: { owner: address },
          fromBlock,
        }),
        // Vault Withdrawals
        publicClient.getContractEvents({
          address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
          abi: ChariotVaultABI,
          eventName: "Withdraw",
          args: { receiver: address },
          fromBlock,
        }),
        // Borrows
        publicClient.getContractEvents({
          address: CHARIOT_ADDRESSES.LENDING_POOL,
          abi: LendingPoolABI,
          eventName: "Borrowed",
          args: { borrower: address },
          fromBlock,
        }),
        // Repayments
        publicClient.getContractEvents({
          address: CHARIOT_ADDRESSES.LENDING_POOL,
          abi: LendingPoolABI,
          eventName: "Repaid",
          args: { borrower: address },
          fromBlock,
        }),
        // Collateral Deposits
        publicClient.getContractEvents({
          address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
          abi: CollateralManagerABI,
          eventName: "CollateralDeposited",
          args: { user: address },
          fromBlock,
        }),
        // Collateral Withdrawals
        publicClient.getContractEvents({
          address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
          abi: CollateralManagerABI,
          eventName: "CollateralWithdrawn",
          args: { user: address },
          fromBlock,
        }),
      ]);

      const extractLogs = <T,>(result: PromiseSettledResult<T[]>): T[] =>
        result.status === "fulfilled" ? result.value : [];

      const depositLogs = extractLogs(results[0]);
      const withdrawLogs = extractLogs(results[1]);
      const borrowLogs = extractLogs(results[2]);
      const repayLogs = extractLogs(results[3]);
      const collateralDepositLogs = extractLogs(results[4]);
      const collateralWithdrawLogs = extractLogs(results[5]);

      // Collect all unique block numbers to batch-fetch timestamps
      const blockNumbers = new Set<bigint>();
      const allLogs = [
        ...depositLogs, ...withdrawLogs, ...borrowLogs,
        ...repayLogs, ...collateralDepositLogs, ...collateralWithdrawLogs,
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
            blockTimestamps.set(blockEntries[i], Number(result.value.timestamp) * 1000);
          }
        }
      }

      const getTimestamp = (blockNumber: bigint | null): number =>
        blockNumber != null && blockTimestamps.has(blockNumber)
          ? blockTimestamps.get(blockNumber)!
          : Date.now();

      const transactions: Transaction[] = [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type AnyLog = any;

      // Map deposit events
      for (const log of depositLogs as AnyLog[]) {
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
      for (const log of withdrawLogs as AnyLog[]) {
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
      for (const log of borrowLogs as AnyLog[]) {
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
      for (const log of repayLogs as AnyLog[]) {
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
      for (const log of collateralDepositLogs as AnyLog[]) {
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
      for (const log of collateralWithdrawLogs as AnyLog[]) {
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
