import {
  publicClient,
  CHARIOT_ADDRESSES,
  CollateralManagerABI,
} from "../setup.js";
import { setETHPrice, getETHPrice } from "../helpers/oracle.js";
import { formatWAD } from "../helpers/format.js";

export const name = "Oracle Price Updates";

export async function run(): Promise<void> {
  await setETHPrice(2500);
  console.log("    Set ETH price to $2,500");

  const price1 = await getETHPrice();
  const expected2500 = BigInt(Math.round(2500 * 1e18));
  if (price1.quantizedValue !== expected2500) {
    throw new Error(
      `Price mismatch: expected ${expected2500}, got ${price1.quantizedValue}`
    );
  }
  console.log(`    Oracle quantizedValue: ${formatWAD(price1.quantizedValue)}`);

  if (price1.timestampNs === 0n) {
    throw new Error("Timestamp is zero");
  }
  console.log(`    Oracle timestampNs: ${price1.timestampNs}`);

  await setETHPrice(3500);
  const price2 = await getETHPrice();
  const expected3500 = BigInt(Math.round(3500 * 1e18));
  if (price2.quantizedValue !== expected3500) {
    throw new Error(
      `Price mismatch: expected ${expected3500}, got ${price2.quantizedValue}`
    );
  }
  console.log(`    Updated to $3,500: ${formatWAD(price2.quantizedValue)}`);

  const cmPrice = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getETHPrice",
  })) as bigint;
  console.log(`    CollateralManager.getETHPrice(): ${formatWAD(cmPrice)}`);
  if (cmPrice === 0n) {
    throw new Error("CollateralManager.getETHPrice() returned 0");
  }

  await setETHPrice(3000);
  console.log("    Reset ETH price to $3,000");
}
