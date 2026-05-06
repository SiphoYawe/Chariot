// chariot/scripts/seed/accumulate.ts
// Long-running loop: every 2 hours, deployer refills lenders and they deposit into vault.
// Run: cd chariot && npx tsx scripts/seed/accumulate.ts
// Stop: Ctrl+C (waits for in-flight txs to settle)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { formatUnits } from "viem";
import {
  USDC, CHARIOT_VAULT, SIMPLE_ORACLE,
  ETHUSD_FEED_ID, ETH_PRICE_WAD,
  ERC20_ABI, VAULT_ABI, ORACLE_ABI,
  usdc,
} from "./lib/constants.js";
import { publicClient, deployerClient, deployerAccount, walletClientFor } from "./lib/clients.js";
import { getLenders, getWallet } from "./lib/wallets.js";
import { execTx, sleep } from "./lib/tx.js";
import { banner, appendLog } from "./lib/logger.js";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

const PENDING_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "pending.json");

function loadPending(): Record<string, bigint> {
  if (fs.existsSync(PENDING_PATH)) {
    const raw = JSON.parse(fs.readFileSync(PENDING_PATH, "utf-8")) as Record<string, string>;
    return { L8: BigInt(raw.L8 ?? "0"), L9: BigInt(raw.L9 ?? "0") };
  }
  return { L8: 0n, L9: 0n };
}

function savePending(state: Record<string, bigint>) {
  fs.writeFileSync(PENDING_PATH, JSON.stringify({ L8: state.L8.toString(), L9: state.L9.toString() }, null, 2));
}

// L8 and L9 accumulate across 2 cycles before depositing
const pendingAccumulation: Record<string, bigint> = loadPending();

let running = true;
process.on("SIGINT", () => {
  console.log("\nShutting down after current cycle...");
  running = false;
});

async function runCycle(cycleNum: number) {
  banner(`Accumulation Cycle #${cycleNum} -- ${new Date().toISOString()}`);
  const lenders = getLenders();

  // Check deployer balance
  const deployerBal = await publicClient.readContract({
    address: USDC, abi: ERC20_ABI, functionName: "balanceOf",
    args: [deployerAccount.address],
  });
  console.log(`  Deployer USDC: $${formatUnits(deployerBal, 6)}`);
  if (deployerBal < usdc(200) + usdc(5)) {
    console.warn("  WARNING: Deployer low on USDC -- skipping refill this cycle");
    return;
  }

  // 1. Refresh oracle
  await execTx("Refresh ETHUSD oracle", deployerClient, {
    address: SIMPLE_ORACLE, abi: ORACLE_ABI, functionName: "setPriceNow",
    args: [ETHUSD_FEED_ID, ETH_PRICE_WAD],
  });

  // 2. Deployer refills each lender with 20 USDC
  for (const lender of lenders) {
    const role = lender.role;
    await execTx(`Refill ${role} with 20 USDC`, deployerClient, {
      address: USDC, abi: ERC20_ABI, functionName: "transfer",
      args: [lender.address, usdc(20)],
    });
    await sleep(500);
  }

  // 3. L1-L4: deposit 20 USDC immediately
  for (const role of ["L1", "L2", "L3", "L4"]) {
    const lender = getWallet(role);
    const client = walletClientFor(lender);
    await execTx(`${role}: approve vault 20 USDC`, client, {
      address: USDC, abi: ERC20_ABI, functionName: "approve",
      args: [CHARIOT_VAULT, usdc(20)],
    });
    await execTx(`${role}: deposit 20 USDC into vault`, client, {
      address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "deposit",
      args: [usdc(20), lender.address],
    });
    await sleep(500);
  }

  // 4. L5-L7: wait 10 minutes then deposit 20 USDC
  console.log("  Waiting 10 minutes before L5-L7 deposits...");
  await sleep(TEN_MINUTES_MS);
  for (const role of ["L5", "L6", "L7"]) {
    const lender = getWallet(role);
    const client = walletClientFor(lender);
    await execTx(`${role}: approve vault 20 USDC`, client, {
      address: USDC, abi: ERC20_ABI, functionName: "approve",
      args: [CHARIOT_VAULT, usdc(20)],
    });
    await execTx(`${role}: deposit 20 USDC into vault (delayed)`, client, {
      address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "deposit",
      args: [usdc(20), lender.address],
    });
    await sleep(500);
  }

  // 5. L8-L9: accumulate; deposit every 2 cycles (40 USDC)
  pendingAccumulation["L8"] = (pendingAccumulation["L8"] ?? 0n) + usdc(20);
  pendingAccumulation["L9"] = (pendingAccumulation["L9"] ?? 0n) + usdc(20);
  savePending(pendingAccumulation);
  for (const role of ["L8", "L9"]) {
    const accumulated = pendingAccumulation[role];
    if (accumulated >= usdc(40)) {
      const lender = getWallet(role);
      const client = walletClientFor(lender);
      await execTx(`${role}: approve vault ${formatUnits(accumulated, 6)} USDC`, client, {
        address: USDC, abi: ERC20_ABI, functionName: "approve",
        args: [CHARIOT_VAULT, accumulated],
      });
      await execTx(`${role}: deposit ${formatUnits(accumulated, 6)} USDC into vault (bulk)`, client, {
        address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "deposit",
        args: [accumulated, lender.address],
      });
      pendingAccumulation[role] = 0n;
      savePending(pendingAccumulation);
    } else {
      console.log(`  ${role}: accumulated ${formatUnits(accumulated, 6)} USDC -- depositing next cycle`);
    }
  }

  // 6. L10: deposit 15 USDC, keep 5 USDC
  const l10 = getWallet("L10");
  const l10Client = walletClientFor(l10);
  await execTx("L10: approve vault 15 USDC", l10Client, {
    address: USDC, abi: ERC20_ABI, functionName: "approve",
    args: [CHARIOT_VAULT, usdc(15)],
  });
  await execTx("L10: deposit 15 USDC into vault (partial depositor)", l10Client, {
    address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "deposit",
    args: [usdc(15), l10.address],
  });

  // Print vault TVL
  const totalAssets = await publicClient.readContract({
    address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "totalAssets",
  });
  console.log(`\n  Vault TVL after cycle #${cycleNum}: $${formatUnits(totalAssets, 6)}`);
  appendLog({ label: `cycle-${cycleNum}-complete`, hash: "n/a", status: "success", note: `TVL=$${formatUnits(totalAssets, 6)}` });
}

async function main() {
  console.log("Starting accumulation loop. Press Ctrl+C to stop gracefully.");
  console.log("Target: run for 12-24 hours to reach ~$1,000-1,200 vault TVL.\n");

  let cycle = 1;
  while (running) {
    try {
      await runCycle(cycle++);
    } catch (e) {
      console.error(`  ERROR in cycle ${cycle - 1}: ${(e as Error).message}`);
      appendLog({ label: `cycle-${cycle - 1}-error`, hash: "n/a", status: "failed", note: String(e) });
    }
    if (!running) break;
    console.log(`\nSleeping 2 hours until next cycle... (${new Date().toISOString()})`);
    await sleep(TWO_HOURS_MS);
  }
  console.log("Accumulation loop stopped.");
}

main().catch((e) => { console.error(e); process.exit(1); });
