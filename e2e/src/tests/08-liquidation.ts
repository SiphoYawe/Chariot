import {
  publicClient,
  deployerAddress,
  deployerAccount,
  sendDeployerTx,
  CHARIOT_ADDRESSES,
  LendingPoolABI,
  CollateralManagerABI,
  LiquidationEngineABI,
  LiquidationEngineLiquidateABI,
} from "../setup.js";
import { setETHPrice } from "../helpers/oracle.js";
import { mintBridgedETH } from "../helpers/mint.js";
import { approveBridgedETH, approveUSDC } from "../helpers/approve.js";

const ONE_ETH = 10n ** 18n;
const BORROW_AMOUNT = 2_000_000n; // 2 USDC

export const name = "Liquidation";

export async function run(): Promise<void> {
  await setETHPrice(3000);
  console.log("    Set ETH price to $3,000");

  await mintBridgedETH(deployerAddress, ONE_ETH);
  await approveBridgedETH(CHARIOT_ADDRESSES.COLLATERAL_MANAGER, ONE_ETH);
  await sendDeployerTx({
    to: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "depositCollateral",
    args: [CHARIOT_ADDRESSES.BRIDGED_ETH, ONE_ETH],
  });
  console.log("    Deposited 1 bETH collateral");

  await sendDeployerTx({
    to: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "borrow",
    args: [CHARIOT_ADDRESSES.BRIDGED_ETH, BORROW_AMOUNT, []],
  });
  console.log("    Borrowed 2 USDC");

  // Crash ETH price to $1 -- with 1 bETH collateral and $2 debt,
  // HF = (1 * 0.82) / 2 = 0.41, well below 1.0
  await setETHPrice(1);
  console.log("    Crashed ETH price to $1");

  const isLiq = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LIQUIDATION_ENGINE,
    abi: LiquidationEngineABI,
    functionName: "isLiquidatable",
    args: [deployerAddress],
  })) as boolean;
  if (!isLiq) {
    throw new Error("Position should be liquidatable at $1 ETH price");
  }
  console.log("    isLiquidatable: true");

  // Test that self-liquidation reverts
  let selfLiqReverted = false;
  try {
    await publicClient.simulateContract({
      account: deployerAccount,
      address: CHARIOT_ADDRESSES.LIQUIDATION_ENGINE,
      abi: LiquidationEngineLiquidateABI,
      functionName: "liquidate",
      args: [deployerAddress, CHARIOT_ADDRESSES.BRIDGED_ETH, 1_000_000n, []],
    });
  } catch {
    selfLiqReverted = true;
    console.log("    Self-liquidation correctly reverted");
  }
  if (!selfLiqReverted) {
    throw new Error("Self-liquidation should revert but did not");
  }

  // Cleanup: restore price, repay, withdraw
  await setETHPrice(3000);
  console.log("    Restored ETH price to $3,000");

  const debt = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LENDING_POOL,
    abi: LendingPoolABI,
    functionName: "getUserDebt",
    args: [deployerAddress],
  })) as bigint;
  await approveUSDC(CHARIOT_ADDRESSES.LENDING_POOL, debt + debt / 5n + 100_000n);
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
