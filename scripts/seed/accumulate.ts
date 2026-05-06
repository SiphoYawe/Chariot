// chariot/scripts/seed/accumulate.ts
// Long-running loop: every 2 hours, each lender deposits available USDC (claimed from faucet).
// Each wallet claims faucet.circle.com independently -- no deployer refill needed.
// Run: cd chariot && npx tsx scripts/seed/accumulate.ts
// Stop: Ctrl+C (waits for in-flight txs to settle)

import { formatUnits } from "viem";
import {
  USDC, CHARIOT_VAULT, SIMPLE_ORACLE,
  ETHUSD_FEED_ID, ETH_PRICE_WAD,
  ERC20_ABI, VAULT_ABI, ORACLE_ABI,
  usdc,
} from "./lib/constants.js";
import { publicClient, deployerClient } from "./lib/clients.js";
import { getLenders } from "./lib/wallets.js";
import { walletClientFor } from "./lib/clients.js";
import { execTx, sleep } from "./lib/tx.js";
import { banner, appendLog } from "./lib/logger.js";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

// Keep $0.50 USDC per wallet for gas
const GAS_RESERVE = usdc(0.5);

let running = true;
process.on("SIGINT", () => {
  console.log("\nShutting down after current cycle...");
  running = false;
});

async function depositAvailable(role: string) {
  const lenders = getLenders();
  const lender = lenders.find((l) => l.role === role);
  if (!lender) return;
  const client = walletClientFor(lender);

  const bal = await publicClient.readContract({
    address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [lender.address],
  });
  if (bal <= GAS_RESERVE) {
    console.log(`  ${role}: $${formatUnits(bal, 6)} -- too low to deposit (claim faucet.circle.com)`);
    return;
  }

  // Approve MAX so the deposit amount can be computed fresh after the approve tx consumes gas.
  // On Arc testnet USDC is the native gas token -- gas is deducted from the USDC balance
  // before transferFrom runs, so depositing the pre-approve balance causes "exceeds balance".
  await execTx(`${role}: approve vault`, client, {
    address: USDC, abi: ERC20_ABI, functionName: "approve",
    args: [CHARIOT_VAULT, 2n ** 256n - 1n],
  });

  // Re-read balance so we deposit exactly what's left after approve gas.
  const balAfter = await publicClient.readContract({
    address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [lender.address],
  });
  const toDeposit = balAfter > GAS_RESERVE ? balAfter - GAS_RESERVE : 0n;
  if (toDeposit < usdc(1)) {
    console.log(`  ${role}: $${formatUnits(balAfter, 6)} after approve -- too low, skipping`);
    return;
  }

  // Set explicit gas limit -- Arc's eth_estimateGas returns inflated values that cause
  // the native-USDC gas pre-charge to consume more than the $0.50 reserve before transferFrom runs.
  await execTx(`${role}: deposit $${formatUnits(toDeposit, 6)}`, client, {
    address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "deposit",
    args: [toDeposit, lender.address],
    gas: 400_000n,
  });
  await sleep(300);
}

async function runCycle(cycleNum: number) {
  banner(`Accumulation Cycle #${cycleNum} -- ${new Date().toISOString()}`);

  // Refresh oracle
  await execTx("Refresh ETHUSD oracle", deployerClient, {
    address: SIMPLE_ORACLE, abi: ORACLE_ABI, functionName: "setPriceNow",
    args: [ETHUSD_FEED_ID, ETH_PRICE_WAD],
  });

  // Deposit from all lenders
  const lenders = getLenders();
  console.log(`  Processing ${lenders.length} lenders...`);
  for (const lender of lenders) {
    try {
      await depositAvailable(lender.role);
    } catch (e) {
      console.error(`  ${lender.role} deposit failed: ${(e as Error).message}`);
    }
  }

  // Print vault TVL
  const totalAssets = await publicClient.readContract({
    address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "totalAssets",
  });
  console.log(`\n  Vault TVL after cycle #${cycleNum}: $${formatUnits(totalAssets, 6)}`);
  appendLog({ label: `cycle-${cycleNum}-complete`, hash: "n/a", status: "success", note: `TVL=$${formatUnits(totalAssets, 6)}` });
}

async function main() {
  const lenders = getLenders();
  const once = process.argv.includes("--once");
  console.log(`Starting accumulation${once ? " (single cycle)" : " loop"} with ${lenders.length} lenders.`);
  console.log(`With funded wallets @ 20 USDC each, one cycle = ~$1,460 TVL.\n`);

  let cycle = 1;
  while (running) {
    try {
      await runCycle(cycle++);
    } catch (e) {
      console.error(`  ERROR in cycle ${cycle - 1}: ${(e as Error).message}`);
      appendLog({ label: `cycle-${cycle - 1}-error`, hash: "n/a", status: "failed", note: String(e) });
    }
    if (once || !running) break;
    console.log(`\nSleeping 2 hours until next cycle... (${new Date().toISOString()})`);
    await sleep(TWO_HOURS_MS);
  }
  console.log("Accumulation done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
