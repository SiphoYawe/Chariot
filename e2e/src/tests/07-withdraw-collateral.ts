import {
  publicClient,
  deployerAddress,
  sendDeployerTx,
  CHARIOT_ADDRESSES,
  CollateralManagerABI,
  LendingPoolABI,
} from "../setup.js";
import { getBETHBalance } from "../helpers/balance.js";
import { formatETH } from "../helpers/format.js";

export const name = "Withdraw Collateral";

export async function run(): Promise<void> {
  const debt = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getUserDebt",
    args: [deployerAddress],
  })) as bigint;
  if (debt !== 0n) {
    throw new Error(`Cannot withdraw -- outstanding debt: ${debt}`);
  }

  const collateral = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getCollateralBalance",
    args: [deployerAddress, CHARIOT_ADDRESSES.BRIDGED_ETH],
  })) as bigint;
  console.log(`    Collateral to withdraw: ${formatETH(collateral)}`);
  if (collateral === 0n) {
    throw new Error("No collateral to withdraw");
  }

  const bethBefore = await getBETHBalance(deployerAddress);

  await sendDeployerTx({
    to: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "withdrawCollateral",
    args: [CHARIOT_ADDRESSES.BRIDGED_ETH, collateral],
  });

  const collAfter = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getCollateralBalance",
    args: [deployerAddress, CHARIOT_ADDRESSES.BRIDGED_ETH],
  })) as bigint;
  if (collAfter !== 0n) {
    throw new Error(`Collateral not zero after withdraw: ${formatETH(collAfter)}`);
  }
  console.log("    Collateral after: 0");

  const bethAfter = await getBETHBalance(deployerAddress);
  if (bethAfter <= bethBefore) {
    throw new Error("bETH balance did not increase after collateral withdrawal");
  }
  console.log(`    bETH balance increased by: ${formatETH(bethAfter - bethBefore)}`);
}
