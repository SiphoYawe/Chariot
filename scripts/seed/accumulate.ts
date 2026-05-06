// chariot/scripts/seed/accumulate.ts
// Long-running loop: every 2 hours, each lender deposits available USDC (claimed from faucet).
// Deployer no longer refills lenders -- each wallet claims faucet.circle.com independently.
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
import { publicClient, deployerClient, walletClientFor } from "./lib/clients.js";
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

// Gas reserve to leave in each lender wallet (covers ~10 txs at $0.05 each)
const GAS_RESERVE = usdc(0.5);

async function depositAvailable(role: string, delayed: boolean = false) {
  const lender = getWallet(role);
  const client = walletClientFor(lender);

  const bal = await publicClient.readContract({
    address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [lender.address],
  });
  const depositable = bal > GAS_RESERVE ? bal - GAS_RESERVE : 0n;

  if (depositable < usdc(1)) {
    console.log(`  ${role}: balance $${formatUnits(bal, 6)} -- too low to deposit (claim faucet.circle.com)`);
    return;
  }

  if (delayed) {
    console.log(`  ${role}: waiting 10 minutes before deposit...`);
    await sleep(TEN_MINUTES_MS);
  }

  await execTx(`${role}: approve vault $${formatUnits(depositable, 6)} USDC`, client, {
    address: USDC, abi: ERC20_ABI, functionName: "approve",
    args: [CHARIOT_VAULT, depositable],
  });
  await execTx(`${role}: deposit $${formatUnits(depositable, 6)} USDC into vault${delayed ? " (delayed)" : ""}`, client, {
    address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "deposit",
    args: [depositable, lender.address],
  });
  await sleep(500);
}

async function runCycle(cycleNum: number) {
  banner(`Accumulation Cycle #${cycleNum} -- ${new Date().toISOString()}`);

  // 1. Refresh oracle (deployer only needs gas for this -- ~$0.05)
  await execTx("Refresh ETHUSD oracle", deployerClient, {
    address: SIMPLE_ORACLE, abi: ORACLE_ABI, functionName: "setPriceNow",
    args: [ETHUSD_FEED_ID, ETH_PRICE_WAD],
  });

  // 2. L1-L4: deposit immediately from own balance (claimed from faucet)
  for (const role of ["L1", "L2", "L3", "L4"]) {
    try { await depositAvailable(role); } catch (e) { console.error(`  ${role} deposit failed: ${(e as Error).message}`); }
  }

  // 3. L5-L7: deposit with 10-minute delay
  for (const role of ["L5", "L6", "L7"]) {
    try { await depositAvailable(role, true); } catch (e) { console.error(`  ${role} deposit failed: ${(e as Error).message}`); }
  }

  // 4. L8-L9: accumulate across 2 cycles (deposit when balance >= 40 USDC)
  for (const role of ["L8", "L9"]) {
    const lender = getWallet(role);
    const bal = await publicClient.readContract({
      address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [lender.address],
    });
    pendingAccumulation[role] = bal > GAS_RESERVE ? bal - GAS_RESERVE : 0n;
    savePending(pendingAccumulation);

    const accumulated = pendingAccumulation[role];
    if (accumulated >= usdc(38)) {
      const client = walletClientFor(lender);
      await execTx(`${role}: approve vault $${formatUnits(accumulated, 6)} USDC (bulk)`, client, {
        address: USDC, abi: ERC20_ABI, functionName: "approve",
        args: [CHARIOT_VAULT, accumulated],
      });
      await execTx(`${role}: deposit $${formatUnits(accumulated, 6)} USDC into vault (bulk)`, client, {
        address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "deposit",
        args: [accumulated, lender.address],
      });
      pendingAccumulation[role] = 0n;
      savePending(pendingAccumulation);
    } else {
      console.log(`  ${role}: $${formatUnits(accumulated, 6)} USDC available -- holding until next cycle`);
    }
  }

  // 5. L10: deposit 75% of balance, keep 25% (partial depositor persona)
  const l10 = getWallet("L10");
  const l10Bal = await publicClient.readContract({
    address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [l10.address],
  });
  const l10Deposit = l10Bal > GAS_RESERVE ? (l10Bal - GAS_RESERVE) * 3n / 4n : 0n;
  if (l10Deposit >= usdc(1)) {
    const l10Client = walletClientFor(l10);
    await execTx(`L10: approve vault $${formatUnits(l10Deposit, 6)} USDC (partial)`, l10Client, {
      address: USDC, abi: ERC20_ABI, functionName: "approve",
      args: [CHARIOT_VAULT, l10Deposit],
    });
    await execTx(`L10: deposit $${formatUnits(l10Deposit, 6)} USDC (keeps 25%)`, l10Client, {
      address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "deposit",
      args: [l10Deposit, l10.address],
    });
  } else {
    console.log(`  L10: $${formatUnits(l10Bal, 6)} balance -- too low to deposit`);
  }

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
