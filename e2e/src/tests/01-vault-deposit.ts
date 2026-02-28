import {
  publicClient,
  deployerAddress,
  sendDeployerTx,
  CHARIOT_ADDRESSES,
  ChariotVaultABI,
} from "../setup.js";
import { getUSDCBalance, getChUSDCBalance } from "../helpers/balance.js";
import { approveUSDC } from "../helpers/approve.js";
import { formatUSDC } from "../helpers/format.js";

const MIN_DEPOSIT = 500_000n; // 0.5 USDC minimum to run test
const TARGET_DEPOSIT = 2_000_000n; // 2 USDC ideal deposit

export const name = "Vault Deposit";

export async function run(): Promise<void> {
  const usdcBefore = await getUSDCBalance(deployerAddress);
  console.log(`    USDC balance before: ${formatUSDC(usdcBefore)}`);

  // Dynamically choose deposit amount based on available balance
  // Reserve 500_000 (0.5 USDC) for gas buffer on future transactions
  const maxDeposit = usdcBefore > 500_000n ? usdcBefore - 500_000n : 0n;
  const depositAmount = maxDeposit > TARGET_DEPOSIT ? TARGET_DEPOSIT : maxDeposit;

  if (depositAmount < MIN_DEPOSIT) {
    throw new Error(
      `Insufficient USDC: have ${formatUSDC(usdcBefore)}, need at least ${formatUSDC(MIN_DEPOSIT + 500_000n)}`
    );
  }
  console.log(`    Depositing: ${formatUSDC(depositAmount)}`);

  const totalAssetsBefore = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "totalAssets",
  })) as bigint;
  console.log(`    Vault totalAssets before: ${formatUSDC(totalAssetsBefore)}`);

  const previewShares = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "previewDeposit",
    args: [depositAmount],
  })) as bigint;
  if (previewShares === 0n) {
    throw new Error("previewDeposit returned 0 shares");
  }
  console.log(`    previewDeposit = ${previewShares} shares`);

  await approveUSDC(CHARIOT_ADDRESSES.CHARIOT_VAULT, depositAmount);

  await sendDeployerTx({
    to: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "deposit",
    args: [depositAmount, deployerAddress],
  });

  const sharesBalance = await getChUSDCBalance(deployerAddress);
  if (sharesBalance === 0n) {
    throw new Error("Deployer received 0 chUSDC shares after deposit");
  }
  console.log(`    chUSDC balance: ${sharesBalance}`);

  const totalAssetsAfter = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "totalAssets",
  })) as bigint;
  if (totalAssetsAfter < totalAssetsBefore + depositAmount - 10_000n) {
    throw new Error(
      `totalAssets did not increase: before=${totalAssetsBefore}, after=${totalAssetsAfter}`
    );
  }
  console.log(`    Vault totalAssets after: ${formatUSDC(totalAssetsAfter)}`);

  const usdcAfter = await getUSDCBalance(deployerAddress);
  const diff = usdcBefore - usdcAfter;
  console.log(`    USDC spent: ${formatUSDC(diff)}`);
}
