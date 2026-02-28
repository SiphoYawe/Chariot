import {
  publicClient,
  deployerAddress,
  sendDeployerTx,
  CHARIOT_ADDRESSES,
  LendingPoolABI,
} from "../setup.js";
import { approveUSDC } from "../helpers/approve.js";
import { formatUSDC } from "../helpers/format.js";

export const name = "Full Repay";

export async function run(): Promise<void> {
  const debt = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getUserDebt",
    args: [deployerAddress],
  })) as bigint;
  console.log(`    Current debt: ${formatUSDC(debt)}`);
  if (debt === 0n) {
    throw new Error("No existing debt -- run borrow test first");
  }

  // Approve with buffer for accrued interest
  const approvalAmount = debt + debt / 10n + 100_000n;
  await approveUSDC(CHARIOT_ADDRESSES.LENDING_POOL, approvalAmount);

  await sendDeployerTx({
    to: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "repayFull",
  });

  const debtAfter = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getUserDebt",
    args: [deployerAddress],
  })) as bigint;
  if (debtAfter !== 0n) {
    throw new Error(`Debt not zero after repayFull: ${formatUSDC(debtAfter)}`);
  }
  console.log("    Debt after repayFull: 0 USDC");

  const position = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getUserPosition",
    args: [deployerAddress],
  })) as any;
  if (position.principal !== 0n) {
    throw new Error(`Position principal not zero: ${position.principal}`);
  }
  console.log("    Position principal: 0");
}
