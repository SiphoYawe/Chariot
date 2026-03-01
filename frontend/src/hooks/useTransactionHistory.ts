"use client";

import { useState, useEffect, useCallback } from "react";
import { decodeEventLog } from "viem";
import {
  ChariotVaultABI,
  LendingPoolABI,
  CollateralManagerABI,
  CHARIOT_ADDRESSES,
} from "@chariot/shared";
import type { Transaction } from "@/types/transaction";

// Blockscout (ArcScan) Etherscan-compatible API -- much more reliable than
// direct RPC eth_getLogs which Arc Testnet doesn't support well.
const ARCSCAN_API = "https://testnet.arcscan.app/api";

/** Raw log entry from the Blockscout Etherscan-compatible API. */
interface BlockscoutLog {
  address: string;
  blockNumber: string; // hex
  data: string; // hex
  timeStamp: string; // hex unix seconds
  topics: (string | null)[];
  transactionHash: string;
}

/** Decoded event with parsed args and metadata. */
interface DecodedEvent {
  transactionHash: string;
  blockNumber: number;
  timestamp: number; // ms
  eventName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;
}

/**
 * Fetch all event logs emitted by a contract via the Blockscout API.
 * Returns raw hex-encoded log entries.
 */
async function fetchContractLogs(
  contractAddress: string
): Promise<BlockscoutLog[]> {
  const url = `${ARCSCAN_API}?module=logs&action=getLogs&address=${contractAddress}&fromBlock=0&toBlock=latest`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ArcScan API returned ${res.status}`);
  const json = await res.json();
  // status "0" with "No records found" is valid (empty), not an error
  if (!Array.isArray(json.result)) return [];
  return json.result;
}

/**
 * Decode raw Blockscout logs against an ABI.
 * Logs that don't match any event in the ABI are silently skipped.
 */
function decodeLogs(
  logs: BlockscoutLog[],
  abi: readonly unknown[]
): DecodedEvent[] {
  const decoded: DecodedEvent[] = [];
  for (const log of logs) {
    try {
      const topics = log.topics.filter(
        (t): t is string => t != null
      ) as `0x${string}`[];
      if (topics.length === 0) continue;

      const result = decodeEventLog({
        abi,
        data: log.data as `0x${string}`,
        topics: topics as [signature: `0x${string}`, ...args: `0x${string}`[]],
      });

      decoded.push({
        transactionHash: log.transactionHash,
        blockNumber: parseInt(log.blockNumber, 16),
        timestamp: parseInt(log.timeStamp, 16) * 1000,
        eventName: result.eventName,
        args: result.args as Record<string, unknown>,
      });
    } catch {
      // Log doesn't match any event in the ABI -- skip
    }
  }
  return decoded;
}

/**
 * Hook for fetching real on-chain transaction history via the ArcScan
 * Blockscout API. Fetches event logs from ChariotVault, LendingPool,
 * and CollateralManager, decodes them using the contract ABIs, and
 * returns all protocol events.
 *
 * Uses the Blockscout Etherscan-compatible API instead of direct RPC
 * eth_getLogs because the Arc Testnet RPC doesn't reliably support
 * log queries.
 */
export function useTransactionHistory() {
  const [data, setData] = useState<Transaction[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch logs from all 3 Chariot contracts in parallel
      const results = await Promise.allSettled([
        fetchContractLogs(CHARIOT_ADDRESSES.CHARIOT_VAULT),
        fetchContractLogs(CHARIOT_ADDRESSES.LENDING_POOL),
        fetchContractLogs(CHARIOT_ADDRESSES.COLLATERAL_MANAGER),
      ]);

      // If every request failed, surface error
      const rejectedCount = results.filter(
        (r) => r.status === "rejected"
      ).length;
      if (rejectedCount === results.length) {
        console.error(
          "[useTransactionHistory] All ArcScan API queries failed:",
          results.map((r) => (r.status === "rejected" ? r.reason : null))
        );
        setIsError(true);
        setIsLoading(false);
        return;
      }

      const extractValue = (
        result: PromiseSettledResult<BlockscoutLog[]>
      ): BlockscoutLog[] =>
        result.status === "fulfilled" ? result.value : [];

      // Decode raw logs using the contract ABIs
      const vaultEvents = decodeLogs(
        extractValue(results[0]),
        ChariotVaultABI
      );
      const poolEvents = decodeLogs(
        extractValue(results[1]),
        LendingPoolABI
      );
      const collateralEvents = decodeLogs(
        extractValue(results[2]),
        CollateralManagerABI
      );

      const transactions: Transaction[] = [];

      // Vault deposits
      for (const e of vaultEvents) {
        if (e.eventName === "Deposit") {
          transactions.push({
            id: `${e.transactionHash}-deposit`,
            type: "deposit",
            asset: "USDC",
            amount: Number((e.args.assets as bigint) ?? BigInt(0)) / 1e6,
            timestamp: e.timestamp,
            txHash: e.transactionHash,
            blockNumber: e.blockNumber,
            status: "confirmed",
          });
        }
      }

      // Vault withdrawals
      for (const e of vaultEvents) {
        if (e.eventName === "Withdraw") {
          transactions.push({
            id: `${e.transactionHash}-withdraw`,
            type: "withdrawal",
            asset: "USDC",
            amount: Number((e.args.assets as bigint) ?? BigInt(0)) / 1e6,
            timestamp: e.timestamp,
            txHash: e.transactionHash,
            blockNumber: e.blockNumber,
            status: "confirmed",
          });
        }
      }

      // Borrows
      for (const e of poolEvents) {
        if (e.eventName === "Borrowed") {
          transactions.push({
            id: `${e.transactionHash}-borrow`,
            type: "borrow",
            asset: "USDC",
            amount: Number((e.args.amount as bigint) ?? BigInt(0)) / 1e6,
            timestamp: e.timestamp,
            txHash: e.transactionHash,
            blockNumber: e.blockNumber,
            status: "confirmed",
          });
        }
      }

      // Repayments
      for (const e of poolEvents) {
        if (e.eventName === "Repaid") {
          transactions.push({
            id: `${e.transactionHash}-repay`,
            type: "repay",
            asset: "USDC",
            amount: Number((e.args.amount as bigint) ?? BigInt(0)) / 1e6,
            timestamp: e.timestamp,
            txHash: e.transactionHash,
            blockNumber: e.blockNumber,
            status: "confirmed",
          });
        }
      }

      // Collateral deposits
      for (const e of collateralEvents) {
        if (e.eventName === "CollateralDeposited") {
          transactions.push({
            id: `${e.transactionHash}-collateral_deposit`,
            type: "collateral_deposit",
            asset: "ETH",
            amount: Number((e.args.amount as bigint) ?? BigInt(0)) / 1e18,
            timestamp: e.timestamp,
            txHash: e.transactionHash,
            blockNumber: e.blockNumber,
            status: "confirmed",
          });
        }
      }

      // Collateral withdrawals
      for (const e of collateralEvents) {
        if (e.eventName === "CollateralWithdrawn") {
          transactions.push({
            id: `${e.transactionHash}-collateral_withdrawal`,
            type: "collateral_withdrawal",
            asset: "ETH",
            amount: Number((e.args.amount as bigint) ?? BigInt(0)) / 1e18,
            timestamp: e.timestamp,
            txHash: e.transactionHash,
            blockNumber: e.blockNumber,
            status: "confirmed",
          });
        }
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
  }, []);

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
