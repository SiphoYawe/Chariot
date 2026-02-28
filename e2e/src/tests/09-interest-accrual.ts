import {
  publicClient,
  deployerAddress,
  sendDeployerTx,
  CHARIOT_ADDRESSES,
  LendingPoolABI,
  CollateralManagerABI,
  LendingPoolAccrueABI,
} from "../setup.js";
import { setETHPrice } from "../helpers/oracle.js";
import { mintBridgedETH } from "../helpers/mint.js";
import { approveBridgedETH, approveUSDC } from "../helpers/approve.js";
import { formatUSDC } from "../helpers/format.js";

const ONE_ETH = 10n ** 18n;
const BORROW_AMOUNT = 1_000_000n; // 1 USDC

export const name = "Interest Accrual";

export async function run(): Promise<void> {
  await setETHPrice(3000);
  await mintBridgedETH(deployerAddress, ONE_ETH);
  await approveBridgedETH(CHARIOT_ADDRESSES.COLLATERAL_MANAGER, ONE_ETH);
  await sendDeployerTx({
    to: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "depositCollateral",
    args: [CHARIOT_ADDRESSES.BRIDGED_ETH, ONE_ETH],
  });
  await sendDeployerTx({
    to: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "borrow",
    args: [CHARIOT_ADDRESSES.BRIDGED_ETH, BORROW_AMOUNT, []],
  });
  console.log("    Deposited 1 bETH, borrowed 1 USDC");

  const indexBefore = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getGlobalInterestIndex",
  })) as bigint;
  console.log(`    Global interest index before: ${indexBefore}`);

  await sendDeployerTx({
    to: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolAccrueABI,
    functionName: "accrueInterest",
  });

  const indexAfter = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getGlobalInterestIndex",
  })) as bigint;
  console.log(`    Global interest index after: ${indexAfter}`);
  if (indexAfter < indexBefore) {
    throw new Error("Global interest index decreased after accrueInterest");
  }

  const debt = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getUserDebt",
    args: [deployerAddress],
  })) as bigint;
  if (debt < BORROW_AMOUNT) {
    throw new Error(`User debt ${debt} is less than principal ${BORROW_AMOUNT}`);
  }
  console.log(`    User debt (with interest): ${formatUSDC(debt)}`);

  const reserves = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getTotalReserves",
  })) as bigint;
  console.log(`    Total reserves: ${formatUSDC(reserves)}`);

  // Cleanup
  const fullDebt = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getUserDebt",
    args: [deployerAddress],
  })) as bigint;
  await approveUSDC(CHARIOT_ADDRESSES.LENDING_POOL, fullDebt + fullDebt / 5n + 100_000n);
  await sendDeployerTx({
    to: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "repayFull",
  });

  const coll = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getCollateralBalance",
    args: [deployerAddress, CHARIOT_ADDRESSES.BRIDGED_ETH],
  })) as bigint;
  if (coll > 0n) {
    await sendDeployerTx({
      to: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
      abi: CollateralManagerABI,
      functionName: "withdrawCollateral",
      args: [CHARIOT_ADDRESSES.BRIDGED_ETH, coll],
    });
  }
  console.log("    Cleanup complete");
}
