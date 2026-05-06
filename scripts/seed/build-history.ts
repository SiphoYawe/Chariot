// chariot/scripts/seed/build-history.ts
// Final history-building step. Run 2-4 hours after setup-borrowers.ts.
// Run: cd chariot && npx tsx scripts/seed/build-history.ts

import { formatUnits } from "viem";
import {
  USDC, BRIDGED_ETH, CHARIOT_VAULT, LENDING_POOL, COLLATERAL_MANAGER, SIMPLE_ORACLE,
  ETHUSD_FEED_ID, ETH_PRICE_WAD,
  ERC20_ABI, BRIDGED_ETH_ABI, VAULT_ABI, COLLATERAL_ABI, POOL_ABI, ORACLE_ABI,
  usdc,
} from "./lib/constants.js";
import { publicClient, deployerClient, walletClientFor } from "./lib/clients.js";
import { getWallet } from "./lib/wallets.js";
import { execTx, sleep } from "./lib/tx.js";
import { banner } from "./lib/logger.js";

async function main() {
  // -- B4: Partial Repayment ($60) --
  banner("B4: Partial Repayment");
  const b4 = getWallet("B4");
  const b4Client = walletClientFor(b4);

  const b4Debt = await publicClient.readContract({
    address: LENDING_POOL, abi: POOL_ABI, functionName: "getUserDebt", args: [b4.address],
  });
  console.log(`  B4 current debt: $${formatUnits(b4Debt, 6)}`);

  const b4RepayAmount = usdc(60);
  if (b4Debt < b4RepayAmount) throw new Error(`B4 debt ($${formatUnits(b4Debt, 6)}) < repay amount ($60)`);

  // Top up B4 if needed -- B4's borrowed USDC may have been spent on gas
  const b4UsdcBal = await publicClient.readContract({
    address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [b4.address],
  });
  console.log(`  B4 USDC balance: $${formatUnits(b4UsdcBal, 6)}`);
  if (b4UsdcBal < b4RepayAmount) {
    const needed = b4RepayAmount - b4UsdcBal + usdc(1);
    await execTx(`Fund B4 with $${formatUnits(needed, 6)} USDC for repayment`, deployerClient, {
      address: USDC, abi: ERC20_ABI, functionName: "transfer", args: [b4.address, needed],
    });
  }

  await execTx("B4: approve LendingPool $60 USDC", b4Client, {
    address: USDC, abi: ERC20_ABI, functionName: "approve", args: [LENDING_POOL, b4RepayAmount],
  });
  await execTx("B4: repay $60 USDC (partial)", b4Client, {
    address: LENDING_POOL, abi: POOL_ABI, functionName: "repay", args: [b4RepayAmount],
  });

  const b4DebtAfter = await publicClient.readContract({
    address: LENDING_POOL, abi: POOL_ABI, functionName: "getUserDebt", args: [b4.address],
  });
  console.log(`  B4 remaining debt: $${formatUnits(b4DebtAfter, 6)}`);
  await sleep(2000);

  // -- B5: Full Repayment + Collateral Withdrawal --
  banner("B5: Full Repayment + Collateral Withdrawal");
  const b5 = getWallet("B5");
  const b5Client = walletClientFor(b5);

  const b5Debt = await publicClient.readContract({
    address: LENDING_POOL, abi: POOL_ABI, functionName: "getUserDebt", args: [b5.address],
  });
  console.log(`  B5 current debt (with interest): $${formatUnits(b5Debt, 6)}`);

  // Top up B5 to cover full debt + buffer for accrued interest
  const b5UsdcBal = await publicClient.readContract({
    address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [b5.address],
  });
  const b5Buffer = usdc(1);
  if (b5UsdcBal < b5Debt + b5Buffer) {
    const needed = b5Debt + b5Buffer - b5UsdcBal;
    await execTx(`Fund B5 with $${formatUnits(needed, 6)} USDC for full repayment`, deployerClient, {
      address: USDC, abi: ERC20_ABI, functionName: "transfer", args: [b5.address, needed],
    });
  }

  // Refresh oracle before repayment/withdrawal
  await execTx("Refresh ETHUSD oracle before B5 repayment", deployerClient, {
    address: SIMPLE_ORACLE, abi: ORACLE_ABI, functionName: "setPriceNow",
    args: [ETHUSD_FEED_ID, ETH_PRICE_WAD],
  });

  await execTx(`B5: approve LendingPool $${formatUnits(b5Debt + b5Buffer, 6)} USDC`, b5Client, {
    address: USDC, abi: ERC20_ABI, functionName: "approve",
    args: [LENDING_POOL, b5Debt + b5Buffer],
  });
  await execTx("B5: repay full debt", b5Client, {
    address: LENDING_POOL, abi: POOL_ABI, functionName: "repay", args: [b5Debt],
  });

  // Withdraw all B5 collateral
  const b5Collateral = await publicClient.readContract({
    address: COLLATERAL_MANAGER, abi: COLLATERAL_ABI, functionName: "getCollateralBalance",
    args: [b5.address, BRIDGED_ETH],
  });
  console.log(`  B5 collateral to withdraw: ${formatUnits(b5Collateral, 18)} ETH`);

  await execTx("B5: withdraw all BridgedETH collateral", b5Client, {
    address: COLLATERAL_MANAGER, abi: COLLATERAL_ABI, functionName: "withdrawCollateral",
    args: [BRIDGED_ETH, b5Collateral],
  });

  const b5DebtAfter = await publicClient.readContract({
    address: LENDING_POOL, abi: POOL_ABI, functionName: "getUserDebt", args: [b5.address],
  });
  console.log(`  B5 final debt: $${formatUnits(b5DebtAfter, 6)} (should be 0)`);
  await sleep(2000);

  // -- L8 + L9: Partial Vault Withdrawals --
  banner("L8 + L9: Partial Vault Withdrawals");
  const withdrawAmount = usdc(35);

  for (const role of ["L8", "L9"]) {
    const lender = getWallet(role);
    const client = walletClientFor(lender);

    const shares = await publicClient.readContract({
      address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "balanceOf",
      args: [lender.address],
    });
    const assets = await publicClient.readContract({
      address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "convertToAssets",
      args: [shares],
    });
    console.log(`  ${role}: holds ${formatUnits(shares, 18)} chUSDC = $${formatUnits(assets, 6)} USDC`);

    const safeWithdraw = assets > withdrawAmount ? withdrawAmount : assets / 2n;
    if (safeWithdraw === 0n) {
      console.log(`  ${role}: insufficient balance, skipping withdrawal`);
      continue;
    }

    await execTx(`${role}: withdraw $${formatUnits(safeWithdraw, 6)} USDC from vault`, client, {
      address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "withdraw",
      args: [safeWithdraw, lender.address, lender.address],
    });
    await sleep(1000);
  }

  banner("History Building Complete");
  console.log("Run verify.ts to check final protocol state.");
}

main().catch((e) => { console.error(e); process.exit(1); });
