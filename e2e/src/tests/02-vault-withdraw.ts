import {
  publicClient,
  deployerAddress,
  sendDeployerTx,
  CHARIOT_ADDRESSES,
  ChariotVaultABI,
} from "../setup.js";
import { getUSDCBalance, getChUSDCBalance } from "../helpers/balance.js";
import { formatUSDC } from "../helpers/format.js";

const WITHDRAW_AMOUNT = 1_000_000n; // 1 USDC

export const name = "Vault Withdraw";

export async function run(): Promise<void> {
  const sharesBefore = await getChUSDCBalance(deployerAddress);
  const usdcBefore = await getUSDCBalance(deployerAddress);
  const totalAssetsBefore = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "totalAssets",
  })) as bigint;
  console.log(`    chUSDC before: ${sharesBefore}`);
  console.log(`    USDC before: ${formatUSDC(usdcBefore)}`);

  if (sharesBefore === 0n) {
    throw new Error("No chUSDC shares to withdraw -- run deposit test first");
  }

  const sharesNeeded = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "previewWithdraw",
    args: [WITHDRAW_AMOUNT],
  })) as bigint;
  console.log(`    previewWithdraw(1 USDC) = ${sharesNeeded} shares`);

  await sendDeployerTx({
    to: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "withdraw",
    args: [WITHDRAW_AMOUNT, deployerAddress, deployerAddress],
  });

  const usdcAfter = await getUSDCBalance(deployerAddress);
  const usdcGain = usdcAfter - usdcBefore;
  if (usdcGain < WITHDRAW_AMOUNT - 50_000n) {
    throw new Error(`USDC did not increase by ~1: gain=${usdcGain}`);
  }
  console.log(`    USDC received: ${formatUSDC(usdcGain)}`);

  const sharesAfter = await getChUSDCBalance(deployerAddress);
  if (sharesAfter >= sharesBefore) {
    throw new Error("chUSDC did not decrease after withdraw");
  }
  console.log(`    chUSDC after: ${sharesAfter}`);

  const totalAssetsAfter = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "totalAssets",
  })) as bigint;
  if (totalAssetsAfter >= totalAssetsBefore) {
    throw new Error("Vault totalAssets did not decrease after withdraw");
  }
  console.log(`    Vault totalAssets after: ${formatUSDC(totalAssetsAfter)}`);
}
