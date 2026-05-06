// chariot/scripts/seed/setup-borrowers.ts
// One-shot: each borrower deposits BridgedETH collateral and borrows USDC.
// Run ONLY after vault TVL >= $600 USDC.
// Run: cd chariot && npx tsx scripts/seed/setup-borrowers.ts

import { formatUnits } from "viem";
import {
  USDC, BRIDGED_ETH, CHARIOT_VAULT, LENDING_POOL, COLLATERAL_MANAGER, SIMPLE_ORACLE,
  ETHUSD_FEED_ID, ETH_PRICE_WAD,
  ERC20_ABI, BRIDGED_ETH_ABI, VAULT_ABI, COLLATERAL_ABI, POOL_ABI, ORACLE_ABI,
  usdc, eth,
} from "./lib/constants.js";
import { publicClient, deployerClient, walletClientFor } from "./lib/clients.js";
import { getWallet } from "./lib/wallets.js";
import { execTx, sleep } from "./lib/tx.js";
import { banner } from "./lib/logger.js";

interface BorrowerSetup {
  role: string;
  collateralAmount: bigint;
  borrowAmount: bigint;
  label: string;
}

const BORROWERS: BorrowerSetup[] = [
  { role: "B1", collateralAmount: eth(0.2), borrowAmount: usdc(80),  label: "The Saver (20% LTV)"      },
  { role: "B2", collateralAmount: eth(0.2), borrowAmount: usdc(160), label: "The Steady (40% LTV)"     },
  { role: "B3", collateralAmount: eth(0.2), borrowAmount: usdc(250), label: "The Leveraged (62.5% LTV)" },
  { role: "B4", collateralAmount: eth(0.2), borrowAmount: usdc(120), label: "The Repayer (30% LTV)"    },
  { role: "B5", collateralAmount: eth(0.15), borrowAmount: usdc(100), label: "The Closed (33% LTV)"    },
];

async function setupBorrower(cfg: BorrowerSetup) {
  banner(`${cfg.role}: ${cfg.label}`);
  const borrower = getWallet(cfg.role);
  const client = walletClientFor(borrower);

  // Check existing collateral balance (idempotent -- skip deposit if already done)
  const existingCollateral = await publicClient.readContract({
    address: COLLATERAL_MANAGER, abi: COLLATERAL_ABI, functionName: "getCollateralBalance",
    args: [borrower.address, BRIDGED_ETH],
  }) as bigint;

  if (existingCollateral >= cfg.collateralAmount) {
    console.log(`  Collateral already deposited: ${formatUnits(existingCollateral, 18)} ETH -- skipping deposit`);
  } else {
    const bridgedEthBal = await publicClient.readContract({
      address: BRIDGED_ETH, abi: BRIDGED_ETH_ABI, functionName: "balanceOf", args: [borrower.address],
    }) as bigint;
    console.log(`  BridgedETH balance: ${formatUnits(bridgedEthBal, 18)} ETH`);
    if (bridgedEthBal < cfg.collateralAmount) {
      throw new Error(`${cfg.role} has insufficient BridgedETH: ${formatUnits(bridgedEthBal, 18)} < ${formatUnits(cfg.collateralAmount, 18)}`);
    }

    await execTx(`${cfg.role}: approve CollateralManager for ${formatUnits(cfg.collateralAmount, 18)} ETH`, client, {
      address: BRIDGED_ETH, abi: BRIDGED_ETH_ABI, functionName: "approve",
      args: [COLLATERAL_MANAGER, cfg.collateralAmount],
    });
    await execTx(`${cfg.role}: deposit ${formatUnits(cfg.collateralAmount, 18)} BridgedETH as collateral`, client, {
      address: COLLATERAL_MANAGER, abi: COLLATERAL_ABI, functionName: "depositCollateral",
      args: [BRIDGED_ETH, cfg.collateralAmount],
    });
  }

  // Check existing debt (skip borrow if already borrowed)
  const existingDebt = await publicClient.readContract({
    address: LENDING_POOL, abi: POOL_ABI, functionName: "getUserDebt", args: [borrower.address],
  }) as bigint;

  if (existingDebt >= cfg.borrowAmount) {
    console.log(`  Already has debt $${formatUnits(existingDebt, 6)} -- skipping borrow`);
  } else {
    // Refresh oracle before borrow (staleness threshold 3600s)
    await execTx("Refresh ETHUSD oracle before borrow", deployerClient, {
      address: SIMPLE_ORACLE, abi: ORACLE_ABI, functionName: "setPriceNow",
      args: [ETHUSD_FEED_ID, ETH_PRICE_WAD],
    });

    await execTx(`${cfg.role}: borrow $${formatUnits(cfg.borrowAmount, 6)} USDC`, client, {
      address: LENDING_POOL, abi: POOL_ABI, functionName: "borrow",
      args: [BRIDGED_ETH, cfg.borrowAmount, []],
      gas: 500_000n,
    });
  }

  // Print resulting position
  const [debt, collateralVal] = await Promise.all([
    publicClient.readContract({ address: LENDING_POOL, abi: POOL_ABI, functionName: "getUserDebt", args: [borrower.address] }),
    publicClient.readContract({ address: COLLATERAL_MANAGER, abi: COLLATERAL_ABI, functionName: "getCollateralValueView", args: [borrower.address] }),
  ]);
  const effectiveLTV = collateralVal > 0n ? (debt * 100n) / collateralVal : 0n;
  console.log(`  Result -- Debt: $${formatUnits(debt, 6)}, Collateral: $${formatUnits(collateralVal, 6)}, LTV: ${effectiveLTV}%`);

  await sleep(2000);
}

async function main() {
  // Gate: check vault TVL
  const totalAssets = await publicClient.readContract({
    address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "totalAssets",
  });
  console.log(`Vault TVL: $${formatUnits(totalAssets, 6)}`);
  if (totalAssets < usdc(600)) {
    throw new Error(`Vault TVL too low ($${formatUnits(totalAssets, 6)}). Wait for accumulate.ts to reach $600+.`);
  }

  for (const borrower of BORROWERS) {
    await setupBorrower(borrower);
  }

  // Final state
  const totalBorrowed = await publicClient.readContract({
    address: LENDING_POOL, abi: POOL_ABI, functionName: "getTotalBorrowed",
  });
  const finalAssets = await publicClient.readContract({
    address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "totalAssets",
  });
  const utilisation = finalAssets > 0n ? (totalBorrowed * 100n) / finalAssets : 0n;

  banner("Borrower Setup Complete");
  console.log(`  Vault TVL:        $${formatUnits(finalAssets, 6)}`);
  console.log(`  Total Borrowed:   $${formatUnits(totalBorrowed, 6)}`);
  console.log(`  Utilisation:      ${utilisation}%`);
  console.log("\nNext: wait 2-4 hours, then run build-history.ts");
}

main().catch((e) => { console.error(e); process.exit(1); });
