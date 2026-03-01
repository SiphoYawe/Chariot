"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import {
  LendingPoolABI,
  CollateralManagerABI,
  CHARIOT_ADDRESSES,
  RISK_PARAMS,
  USDC_ERC20_DECIMALS,
} from "@chariot/shared";

export interface BorrowerPosition {
  address: string;
  collateralType: string;
  collateralAmount: number;
  collateralValueUSD: number;
  debtAmount: number;
  healthFactor: number;
}

const WAD = BigInt(10) ** BigInt(18);
const USDC_DIVISOR = 10 ** USDC_ERC20_DECIMALS;
const ARCSCAN_API = "https://testnet.arcscan.app/api";

/**
 * Discover unique protocol participant addresses from on-chain event logs.
 * Extracts the first indexed parameter (topic1) from LendingPool and
 * CollateralManager events -- this is always the user/borrower address.
 */
async function discoverProtocolUsers(): Promise<string[]> {
  const addresses = new Set<string>();

  const extractFromLogs = async (contractAddress: string) => {
    try {
      const url = `${ARCSCAN_API}?module=logs&action=getLogs&address=${contractAddress}&fromBlock=0&toBlock=latest`;
      const res = await fetch(url);
      if (!res.ok) return;
      const json = await res.json();
      if (!Array.isArray(json.result)) return;
      for (const log of json.result) {
        if (log.topics?.[1]) {
          // Indexed address is zero-padded to 32 bytes in topic1
          const raw = "0x" + (log.topics[1] as string).slice(26);
          addresses.add(raw.toLowerCase());
        }
      }
    } catch {
      // Partial discovery is acceptable
    }
  };

  await Promise.all([
    extractFromLogs(CHARIOT_ADDRESSES.LENDING_POOL),
    extractFromLogs(CHARIOT_ADDRESSES.COLLATERAL_MANAGER),
  ]);

  return Array.from(addresses);
}

/**
 * Hook for fetching all active borrower positions across the protocol.
 * Discovers participant addresses from on-chain events via the Blockscout
 * API, then queries each address's debt and collateral on-chain.
 * Also includes the connected wallet address if present.
 */
export function useBorrowerPositions() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [positions, setPositions] = useState<BorrowerPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchPositions = useCallback(async () => {
    if (!publicClient) return;

    try {
      setIsLoading(true);

      // 1. Discover all protocol user addresses from events
      const discovered = await discoverProtocolUsers();
      const allAddresses = new Set(discovered);

      // Include connected wallet (in case it has a position but no events yet)
      if (address) allAddresses.add(address.toLowerCase());

      if (allAddresses.size === 0) {
        setPositions([]);
        setIsError(false);
        setIsLoading(false);
        return;
      }

      // 2. Read ETH price
      const rawEthPrice = await publicClient.readContract({
        address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER as `0x${string}`,
        abi: CollateralManagerABI,
        functionName: "getETHPrice",
      });
      const ethPrice = Number(rawEthPrice as bigint) / Number(WAD);

      // 3. Query each address's debt and collateral in parallel
      const addrs = Array.from(allAddresses);
      const built: BorrowerPosition[] = [];

      await Promise.all(
        addrs.map(async (addr) => {
          try {
            const [debt, collateral] = await Promise.all([
              publicClient.readContract({
                address: CHARIOT_ADDRESSES.LENDING_POOL as `0x${string}`,
                abi: LendingPoolABI,
                functionName: "getUserDebt",
                args: [addr as `0x${string}`],
              }),
              publicClient.readContract({
                address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER as `0x${string}`,
                abi: CollateralManagerABI,
                functionName: "getCollateralBalance",
                args: [addr as `0x${string}`, CHARIOT_ADDRESSES.BRIDGED_ETH as `0x${string}`],
              }),
            ]);

            const debtNum = Number(debt as bigint) / USDC_DIVISOR;
            const collateralAmount = Number(collateral as bigint) / Number(WAD);
            const collateralValueUSD = collateralAmount * ethPrice;

            // Skip addresses with no active position
            if (debtNum === 0 && collateralAmount === 0) return;

            const healthFactor =
              debtNum > 0
                ? (collateralValueUSD *
                    RISK_PARAMS.BRIDGED_ETH.LIQUIDATION_THRESHOLD) /
                  debtNum
                : Infinity;

            built.push({
              address: addr,
              collateralType: "BridgedETH",
              collateralAmount,
              collateralValueUSD,
              debtAmount: debtNum,
              healthFactor,
            });
          } catch {
            // Skip addresses that fail to query
          }
        }),
      );

      setPositions(built);
      setIsError(false);
    } catch (err) {
      console.error("[useBorrowerPositions] Failed to fetch positions:", err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [address, publicClient]);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 30_000);
    return () => clearInterval(interval);
  }, [fetchPositions]);

  const refetch = useCallback(() => {
    fetchPositions();
  }, [fetchPositions]);

  return { positions, isLoading, isError, refetch };
}
