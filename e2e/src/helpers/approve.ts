import type { Address } from "viem";
import {
  sendDeployerTx,
  ADDRESSES,
  CHARIOT_ADDRESSES,
  ERC20ABI,
  BridgedETHABI,
} from "../setup.js";

/**
 * Approve a spender to transfer USDC on behalf of the deployer.
 */
export async function approveUSDC(
  spender: Address,
  amount: bigint
): Promise<void> {
  await sendDeployerTx({
    to: ADDRESSES.USDC as `0x${string}`,
    abi: ERC20ABI,
    functionName: "approve",
    args: [spender, amount],
  });
}

/**
 * Approve a spender to transfer BridgedETH on behalf of the deployer.
 */
export async function approveBridgedETH(
  spender: Address,
  amount: bigint
): Promise<void> {
  await sendDeployerTx({
    to: CHARIOT_ADDRESSES.BRIDGED_ETH,
    abi: BridgedETHABI,
    functionName: "approve",
    args: [spender, amount],
  });
}
