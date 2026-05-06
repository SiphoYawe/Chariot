// chariot/scripts/seed/verify.ts
// Pre-demo verification: reads all protocol state and prints summary.
// Run: cd chariot && npx tsx scripts/seed/verify.ts

import { formatUnits } from "viem";
import {
  USDC, BRIDGED_ETH, CHARIOT_VAULT, LENDING_POOL, COLLATERAL_MANAGER,
  ERC20_ABI, BRIDGED_ETH_ABI, VAULT_ABI, COLLATERAL_ABI, POOL_ABI,
  usdc,
} from "./lib/constants.js";
import { publicClient } from "./lib/clients.js";
import { getLenders, getBorrowers } from "./lib/wallets.js";
import { banner } from "./lib/logger.js";

function check(label: string, value: bigint, min: bigint, max: bigint): boolean {
  const pass = value >= min && value <= max;
  const icon = pass ? "OK  " : "FAIL";
  console.log(`  [${icon}] ${label}: ${value} (range: ${min}-${max})`);
  return pass;
}

async function main() {
  banner("Protocol State Verification");
  let allPassed = true;

  // -- Vault --
  const [totalAssets, totalLent, totalSupply] = await Promise.all([
    publicClient.readContract({ address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "totalAssets" }),
    publicClient.readContract({ address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "totalLent" }),
    publicClient.readContract({ address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "totalSupply" }),
  ]);
  const sharePrice = totalSupply > 0n
    ? await publicClient.readContract({ address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "convertToAssets", args: [10n ** 18n] })
    : 0n;

  console.log("\nChariotVault:");
  console.log(`  TVL (totalAssets):  $${formatUnits(totalAssets, 6)}`);
  console.log(`  Total Lent:         $${formatUnits(totalLent, 6)}`);
  console.log(`  Total Supply:       ${formatUnits(totalSupply, 18)} chUSDC`);
  console.log(`  Share Price:        $${formatUnits(sharePrice, 6)} per chUSDC`);
  allPassed = check("TVL >= $500", totalAssets, usdc(500), usdc(999_999)) && allPassed;
  allPassed = check("totalSupply > 0", totalSupply, 1n, BigInt("9999999999999999999999999")) && allPassed;
  allPassed = check("sharePrice >= $1.00", sharePrice, usdc(1), usdc(999)) && allPassed;

  // -- Lending Pool --
  const totalBorrowed = await publicClient.readContract({
    address: LENDING_POOL, abi: POOL_ABI, functionName: "getTotalBorrowed",
  });
  const utilisation = totalAssets > 0n ? (totalBorrowed * 10000n) / totalAssets : 0n;

  console.log("\nLendingPool:");
  console.log(`  Total Borrowed:     $${formatUnits(totalBorrowed, 6)}`);
  console.log(`  Utilisation:        ${Number(utilisation) / 100}%`);
  allPassed = check("totalBorrowed >= $200", totalBorrowed, usdc(200), usdc(999_999)) && allPassed;
  allPassed = check("utilisation 20%-70%", utilisation, 2000n, 7000n) && allPassed;

  // -- Borrower Positions --
  console.log("\nBorrower Positions:");
  const borrowers = getBorrowers();
  for (const borrower of borrowers) {
    const debt = await publicClient.readContract({
      address: LENDING_POOL, abi: POOL_ABI, functionName: "getUserDebt", args: [borrower.address],
    });
    const collateral = await publicClient.readContract({
      address: COLLATERAL_MANAGER, abi: COLLATERAL_ABI, functionName: "getCollateralBalance",
      args: [borrower.address, BRIDGED_ETH],
    });
    const collateralValue = await publicClient.readContract({
      address: COLLATERAL_MANAGER, abi: COLLATERAL_ABI, functionName: "getCollateralValueView",
      args: [borrower.address],
    });
    const ltv = collateralValue > 0n ? (debt * 100n) / collateralValue : 0n;
    const status = borrower.role === "B5" ? "(should be closed)" : "(should be open)";
    console.log(`  ${borrower.role}: debt=$${formatUnits(debt, 6)}, collateral=${formatUnits(collateral, 18)} ETH ($${formatUnits(collateralValue, 6)}), LTV=${ltv}% ${status}`);
  }

  // Specific checks for B5 closed position
  const b5 = borrowers.find((b) => b.role === "B5")!;
  const b5Debt = await publicClient.readContract({
    address: LENDING_POOL, abi: POOL_ABI, functionName: "getUserDebt", args: [b5.address],
  });
  allPassed = check("B5 debt == 0 (position closed)", b5Debt, 0n, usdc(0.01)) && allPassed;

  const b5Collateral = await publicClient.readContract({
    address: COLLATERAL_MANAGER, abi: COLLATERAL_ABI, functionName: "getCollateralBalance",
    args: [b5.address, BRIDGED_ETH],
  });
  allPassed = check("B5 collateral == 0 (withdrawn)", b5Collateral, 0n, 10n ** 15n) && allPassed;

  // -- Lender Vault Shares --
  console.log("\nLender Vault Shares:");
  const lenders = getLenders();
  for (const lender of lenders) {
    const shares = await publicClient.readContract({
      address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "balanceOf", args: [lender.address],
    });
    const assets = shares > 0n
      ? await publicClient.readContract({ address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "convertToAssets", args: [shares] })
      : 0n;
    console.log(`  ${lender.role}: ${formatUnits(shares, 18)} chUSDC = $${formatUnits(assets, 6)}`);
  }

  // -- Final result --
  banner(allPassed ? "ALL CHECKS PASSED -- Ready for demo" : "CHECKS FAILED -- See above");
  process.exit(allPassed ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
