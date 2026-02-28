import type { Address } from "viem";
import {
  publicClient,
  ADDRESSES,
  CHARIOT_ADDRESSES,
  ERC20ABI,
  BridgedETHABI,
  ChariotVaultABI,
} from "../setup.js";

/**
 * Get USDC balance (ERC-20, 6 decimals) for an address.
 */
export async function getUSDCBalance(addr: Address): Promise<bigint> {
  return publicClient.readContract({
    address: ADDRESSES.USDC as `0x${string}`,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: [addr],
  }) as Promise<bigint>;
}

/**
 * Get BridgedETH balance (18 decimals) for an address.
 */
export async function getBETHBalance(addr: Address): Promise<bigint> {
  return publicClient.readContract({
    address: CHARIOT_ADDRESSES.BRIDGED_ETH,
    abi: BridgedETHABI,
    functionName: "balanceOf",
    args: [addr],
  }) as Promise<bigint>;
}

/**
 * Get chUSDC (vault share) balance for an address.
 */
export async function getChUSDCBalance(addr: Address): Promise<bigint> {
  return publicClient.readContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "balanceOf",
    args: [addr],
  }) as Promise<bigint>;
}
