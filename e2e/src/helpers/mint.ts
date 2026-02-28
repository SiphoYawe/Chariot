import type { Address } from "viem";
import {
  sendRelayerTx,
  CHARIOT_ADDRESSES,
  BridgedETHMintABI,
} from "../setup.js";

// Incrementing nonce counter to avoid collisions
let mintNonce = BigInt(Date.now()) * 1000n;

/**
 * Mint BridgedETH to a recipient using the relayer key (MINTER_ROLE).
 * @param to -- recipient address
 * @param amount -- amount in wei (18 decimals), e.g. 1e18 for 1 bETH
 */
export async function mintBridgedETH(
  to: Address,
  amount: bigint
): Promise<void> {
  const nonce = mintNonce++;
  await sendRelayerTx({
    to: CHARIOT_ADDRESSES.BRIDGED_ETH,
    abi: BridgedETHMintABI,
    functionName: "mint",
    args: [to, amount, nonce],
  });
}
