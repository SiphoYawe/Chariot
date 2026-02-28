"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import {
  ChariotVaultABI,
  LendingPoolABI,
  CollateralManagerABI,
  CHARIOT_ADDRESSES,
} from "@chariot/shared";
import type { Transaction } from "@/types/transaction";

const MAX_BLOCKS_BACK = BigInt(50_000);

/**
 * Hook for fetching real on-chain transaction history from contract events.
 * Reads indexed events from ChariotVault, LendingPool, and CollateralManager.
 */
export function useTransactionHistory() {
  const [data, setData] = useState<Transaction[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const { address } = useAccount();
  const publicClient = usePublicClient();

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

      const transactions: Transaction[] = [];

      // Fetch events in parallel
      const [depositLogs, withdrawLogs, borrowLogs, repayLogs, collateralDepositLogs, collateralWithdrawLogs] =
        await Promise.all([
          // Vault Deposits
          publicClient.getContractEvents({
            address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
            abi: ChariotVaultABI,
            eventName: "Deposit",
            args: { owner: address },
            fromBlock,
          }).catch(() => []),
          // Vault Withdrawals
          publicClient.getContractEvents({
            address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
            abi: ChariotVaultABI,
            eventName: "Withdraw",
            args: { receiver: address },
            fromBlock,
          }).catch(() => []),
          // Borrows
          publicClient.getContractEvents({
            address: CHARIOT_ADDRESSES.LENDING_POOL,
            abi: LendingPoolABI,
            eventName: "Borrowed",
            args: { borrower: address },
            fromBlock,
          }).catch(() => []),
          // Repayments
          publicClient.getContractEvents({
            address: CHARIOT_ADDRESSES.LENDING_POOL,
            abi: LendingPoolABI,
            eventName: "Repaid",
            args: { borrower: address },
            fromBlock,
          }).catch(() => []),
          // Collateral Deposits
          publicClient.getContractEvents({
            address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
            abi: CollateralManagerABI,
            eventName: "CollateralDeposited",
            args: { user: address },
            fromBlock,
          }).catch(() => []),
          // Collateral Withdrawals
          publicClient.getContractEvents({
            address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
            abi: CollateralManagerABI,
            eventName: "CollateralWithdrawn",
            args: { user: address },
            fromBlock,
          }).catch(() => []),
        ]);

      // Map deposit events
      for (const log of depositLogs) {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber! });
        transactions.push({
          id: `${log.transactionHash}-deposit`,
          type: "deposit",
          asset: "USDC",
          amount: Number(log.args.assets ?? BigInt(0)) / 1e6,
          timestamp: Number(block.timestamp) * 1000,
          txHash: log.transactionHash!,
          blockNumber: Number(log.blockNumber),
          status: "confirmed",
        });
      }

      // Map withdrawal events
      for (const log of withdrawLogs) {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber! });
        transactions.push({
          id: `${log.transactionHash}-withdraw`,
          type: "withdrawal",
          asset: "USDC",
          amount: Number(log.args.assets ?? BigInt(0)) / 1e6,
          timestamp: Number(block.timestamp) * 1000,
          txHash: log.transactionHash!,
          blockNumber: Number(log.blockNumber),
          status: "confirmed",
        });
      }

      // Map borrow events
      for (const log of borrowLogs) {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber! });
        transactions.push({
          id: `${log.transactionHash}-borrow`,
          type: "borrow",
          asset: "USDC",
          amount: Number(log.args.amount ?? BigInt(0)) / 1e6,
          timestamp: Number(block.timestamp) * 1000,
          txHash: log.transactionHash!,
          blockNumber: Number(log.blockNumber),
          status: "confirmed",
        });
      }

      // Map repay events
      for (const log of repayLogs) {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber! });
        transactions.push({
          id: `${log.transactionHash}-repay`,
          type: "repay",
          asset: "USDC",
          amount: Number(log.args.amount ?? BigInt(0)) / 1e6,
          timestamp: Number(block.timestamp) * 1000,
          txHash: log.transactionHash!,
          blockNumber: Number(log.blockNumber),
          status: "confirmed",
        });
      }

      // Map collateral deposit events
      for (const log of collateralDepositLogs) {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber! });
        transactions.push({
          id: `${log.transactionHash}-collateral_deposit`,
          type: "collateral_deposit",
          asset: "ETH",
          amount: Number(log.args.amount ?? BigInt(0)) / 1e18,
          timestamp: Number(block.timestamp) * 1000,
          txHash: log.transactionHash!,
          blockNumber: Number(log.blockNumber),
          status: "confirmed",
        });
      }

      // Map collateral withdrawal events
      for (const log of collateralWithdrawLogs) {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber! });
        transactions.push({
          id: `${log.transactionHash}-collateral_withdrawal`,
          type: "collateral_withdrawal",
          asset: "ETH",
          amount: Number(log.args.amount ?? BigInt(0)) / 1e18,
          timestamp: Number(block.timestamp) * 1000,
          txHash: log.transactionHash!,
          blockNumber: Number(log.blockNumber),
          status: "confirmed",
        });
      }

      // Sort by timestamp descending (most recent first)
      transactions.sort((a, b) => b.timestamp - a.timestamp);
      setData(transactions);
      setIsLoading(false);
    } catch {
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
