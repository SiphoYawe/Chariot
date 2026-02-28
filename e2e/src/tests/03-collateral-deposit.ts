import {
  publicClient,
  deployerAddress,
  sendDeployerTx,
  CHARIOT_ADDRESSES,
  CollateralManagerABI,
} from "../setup.js";
import { setETHPrice } from "../helpers/oracle.js";
import { mintBridgedETH } from "../helpers/mint.js";
import { approveBridgedETH } from "../helpers/approve.js";
import { formatETH, formatUSDC } from "../helpers/format.js";

const ONE_ETH = 10n ** 18n;

export const name = "Collateral Deposit";

export async function run(): Promise<void> {
  await setETHPrice(3000);
  console.log("    Set ETH price to $3,000");

  await mintBridgedETH(deployerAddress, ONE_ETH);
  console.log("    Minted 1 bETH to deployer");

  await approveBridgedETH(CHARIOT_ADDRESSES.COLLATERAL_MANAGER, ONE_ETH);

  await sendDeployerTx({
    to: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "depositCollateral",
    args: [CHARIOT_ADDRESSES.BRIDGED_ETH, ONE_ETH],
  });

  const collBal = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getCollateralBalance",
    args: [deployerAddress, CHARIOT_ADDRESSES.BRIDGED_ETH],
  })) as bigint;
  if (collBal < ONE_ETH) {
    throw new Error(`Collateral balance too low: ${formatETH(collBal)}`);
  }
  console.log(`    Collateral balance: ${formatETH(collBal)}`);

  const collValue = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getCollateralValueView",
    args: [deployerAddress],
  })) as bigint;
  if (collValue === 0n) {
    throw new Error("Collateral value is zero");
  }
  console.log(`    Collateral value: ${formatUSDC(collValue)}`);
}
