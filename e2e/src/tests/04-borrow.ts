import {
  publicClient,
  deployerAddress,
  sendDeployerTx,
  simulateDeployerCall,
  CHARIOT_ADDRESSES,
  LendingPoolABI,
  CollateralManagerABI,
} from "../setup.js";
import { getUSDCBalance } from "../helpers/balance.js";
import { formatUSDC, formatWAD } from "../helpers/format.js";

const BORROW_AMOUNT = 1_000_000n; // 1 USDC

export const name = "Borrow";

export async function run(): Promise<void> {
  const usdcBefore = await getUSDCBalance(deployerAddress);
  console.log(`    USDC before: ${formatUSDC(usdcBefore)}`);

  await sendDeployerTx({
    to: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "borrow",
    args: [CHARIOT_ADDRESSES.BRIDGED_ETH, BORROW_AMOUNT, []],
  });

  const usdcAfter = await getUSDCBalance(deployerAddress);
  const usdcGain = usdcAfter - usdcBefore;
  // On Arc, native currency is USDC so gas costs reduce the net USDC gain slightly.
  // Allow up to 1% tolerance (10_000 out of 1_000_000).
  if (usdcGain < BORROW_AMOUNT - 10_000n) {
    throw new Error(`USDC gain too low: ${formatUSDC(usdcGain)}`);
  }
  console.log(`    USDC received: ${formatUSDC(usdcGain)}`);

  const debt = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getUserDebt",
    args: [deployerAddress],
  })) as bigint;
  if (debt < BORROW_AMOUNT) {
    throw new Error(`Debt too low: ${formatUSDC(debt)}`);
  }
  console.log(`    User debt: ${formatUSDC(debt)}`);

  const position = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getUserPosition",
    args: [deployerAddress],
  })) as any;
  if (position.principal === 0n) {
    throw new Error("Position principal is zero");
  }
  console.log(`    Position principal: ${formatUSDC(position.principal)}`);

  const totalBorrowed = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getTotalBorrowed",
  })) as bigint;
  if (totalBorrowed === 0n) {
    throw new Error("Total borrowed is zero");
  }
  console.log(`    Total borrowed: ${formatUSDC(totalBorrowed)}`);

  // getHealthFactor is nonpayable, use simulateDeployerCall
  const hf = await simulateDeployerCall<bigint>({
    to: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getHealthFactor",
    args: [deployerAddress, []],
  });
  console.log(`    Health factor: ${formatWAD(hf)}`);
  if (hf < 10n ** 18n) {
    throw new Error(`Health factor below 1.0: ${formatWAD(hf)}`);
  }
}
