import {
  publicClient,
  deployerAddress,
  sendDeployerTx,
  simulateDeployerCall,
  CHARIOT_ADDRESSES,
  LendingPoolABI,
  CollateralManagerABI,
  LiquidationEngineABI,
} from "../setup.js";
import { setETHPrice } from "../helpers/oracle.js";
import { mintBridgedETH } from "../helpers/mint.js";
import { approveBridgedETH, approveUSDC } from "../helpers/approve.js";
import { formatWAD } from "../helpers/format.js";

const ONE_ETH = 10n ** 18n;
const WAD = 10n ** 18n;
const BORROW_AMOUNT = 1_000_000n; // 1 USDC

export const name = "Health Factor Calculations";

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

  // At $3000: HF = (3000 * 0.82) / 1 = 2460 -- very high since debt is only $1
  const hf3000 = await simulateDeployerCall<bigint>({
    to: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getHealthFactor",
    args: [deployerAddress, []],
  });
  console.log(`    HF at $3,000: ${formatWAD(hf3000)}`);
  if (hf3000 < WAD) {
    throw new Error(`HF at $3000 below 1.0: ${formatWAD(hf3000)}`);
  }

  // At $1: HF = (1 * 0.82) / 1 = 0.82 (liquidatable)
  await setETHPrice(1);
  const hfLow = await simulateDeployerCall<bigint>({
    to: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getHealthFactor",
    args: [deployerAddress, []],
  });
  console.log(`    HF at $1: ${formatWAD(hfLow)}`);
  if (hfLow >= WAD) {
    throw new Error(`HF should be below 1.0 at $1: ${formatWAD(hfLow)}`);
  }

  const isLiq = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.LIQUIDATION_ENGINE,
    abi: LiquidationEngineABI,
    functionName: "isLiquidatable",
    args: [deployerAddress],
  })) as boolean;
  if (!isLiq) {
    throw new Error("Position should be liquidatable at $1");
  }
  console.log("    isLiquidatable at $1: true");

  // Cleanup
  await setETHPrice(3000);
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
