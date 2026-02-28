import {
  ADDRESSES,
  CHARIOT_ADDRESSES,
  ChariotVaultABI,
  LendingPoolABI,
  InterestRateModelABI,
  ERC20ABI,
  RATE_MODEL,
} from "@chariot/shared";
import type { AgentConfig } from "../config.js";
import { getPublicClient } from "../rpcClient.js";
import { log } from "../logger.js";

export interface VaultState {
  totalAssets: bigint; // USDC 6 decimals
  totalLent: bigint; // USDC 6 decimals
  idleUSDC: bigint; // USDC 6 decimals
  usycBalance: bigint; // USYC 18 decimals
  totalBorrowed: bigint; // USDC 6 decimals
  utilisation: bigint; // WAD (18 decimals)
  usycYieldRate: number;
  timestamp: number;
}

export async function readOnChainState(config: AgentConfig): Promise<VaultState> {
  const client = getPublicClient(config);
  const vaultAddress = CHARIOT_ADDRESSES.CHARIOT_VAULT;
  const lendingPoolAddress = CHARIOT_ADDRESSES.LENDING_POOL;
  const interestRateModelAddress = CHARIOT_ADDRESSES.INTEREST_RATE_MODEL;

  // Batch all reads in a single multicall for efficiency
  const results = await client.multicall({
    contracts: [
      {
        address: vaultAddress,
        abi: ChariotVaultABI,
        functionName: "totalAssets",
      },
      {
        address: vaultAddress,
        abi: ChariotVaultABI,
        functionName: "totalLent",
      },
      {
        address: ADDRESSES.USDC as `0x${string}`,
        abi: ERC20ABI,
        functionName: "balanceOf",
        args: [vaultAddress],
      },
      {
        address: ADDRESSES.USYC as `0x${string}`,
        abi: ERC20ABI,
        functionName: "balanceOf",
        args: [vaultAddress],
      },
      {
        address: lendingPoolAddress,
        abi: LendingPoolABI,
        functionName: "getTotalBorrowed",
      },
    ],
  });

  // Validate all multicall results before extracting
  for (let i = 0; i < results.length; i++) {
    if (results[i].status !== "success") {
      const errorMsg = results[i].error?.message ?? "Unknown multicall error";
      throw new Error(`Multicall result[${i}] failed: ${errorMsg}`);
    }
  }

  const totalAssets = results[0].result as bigint;
  const totalLent = results[1].result as bigint;
  const idleUSDC = results[2].result as bigint;
  const usycBalance = results[3].result as bigint;
  const totalBorrowed = results[4].result as bigint;

  // Calculate utilisation using the on-chain model for canonical results
  let utilisation = 0n;
  if (totalAssets > 0n) {
    const utilisationResult = await client.readContract({
      address: interestRateModelAddress,
      abi: InterestRateModelABI,
      functionName: "getUtilisation",
      args: [totalBorrowed, totalAssets],
    });
    utilisation = utilisationResult as bigint;
  }

  // USYC yield is a fixed rate (4.5% annualized) from protocol config
  const usycYieldRate = RATE_MODEL.USYC_YIELD;

  const state: VaultState = {
    totalAssets,
    totalLent,
    idleUSDC,
    usycBalance,
    totalBorrowed,
    utilisation,
    usycYieldRate,
    timestamp: Date.now(),
  };

  log("debug", "vault_state_read", {
    totalAssets: totalAssets.toString(),
    totalLent: totalLent.toString(),
    idleUSDC: idleUSDC.toString(),
    usycBalance: usycBalance.toString(),
    utilisation: utilisation.toString(),
  });

  return state;
}
