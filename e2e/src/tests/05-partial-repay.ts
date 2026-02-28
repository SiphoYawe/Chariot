import {
  publicClient,
  deployerAddress,
  sendDeployerTx,
  CHARIOT_ADDRESSES,
  LendingPoolABI,
} from "../setup.js";
import { approveUSDC } from "../helpers/approve.js";
import { formatUSDC } from "../helpers/format.js";

const REPAY_AMOUNT = 500_000n; // 0.5 USDC

export const name = "Partial Repay";

export async function run(): Promise<void> {
  const debtBefore = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getUserDebt",
    args: [deployerAddress],
  })) as bigint;
  console.log(`    Debt before: ${formatUSDC(debtBefore)}`);
  if (debtBefore === 0n) {
    throw new Error("No existing debt -- run borrow test first");
  }

  await approveUSDC(CHARIOT_ADDRESSES.LENDING_POOL, REPAY_AMOUNT);

  await sendDeployerTx({
    to: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "repay",
    args: [REPAY_AMOUNT],
  });

  const debtAfter = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getUserDebt",
    args: [deployerAddress],
  })) as bigint;
  if (debtAfter >= debtBefore) {
    throw new Error(`Debt did not decrease: before=${debtBefore}, after=${debtAfter}`);
  }
  console.log(`    Debt after: ${formatUSDC(debtAfter)}`);

  const reduction = debtBefore - debtAfter;
  console.log(`    Debt reduced by: ${formatUSDC(reduction)}`);
}
