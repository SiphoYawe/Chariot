// chariot/scripts/seed/lib/tx.ts
import { publicClient } from "./clients.js";
import { appendLog } from "./logger.js";
import type { WalletClient, ContractFunctionParameters } from "viem";

export async function execTx(
  label: string,
  walletClient: WalletClient,
  params: ContractFunctionParameters & { address: `0x${string}` }
): Promise<`0x${string}`> {
  process.stdout.write(`  [TX] ${label}... `);
  const hash = await walletClient.writeContract(params as any);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    console.log("FAILED");
    appendLog({ label, hash, status: "failed" });
    throw new Error(`Transaction reverted: ${hash}`);
  }
  console.log(`ok (${hash.slice(0, 10)}...)`);
  appendLog({ label, hash, status: "success" });
  return hash;
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
