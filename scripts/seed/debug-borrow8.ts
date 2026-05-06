import { publicClient, walletClientFor } from './lib/clients.js';
import { LENDING_POOL, BRIDGED_ETH, POOL_ABI, usdc, SIMPLE_ORACLE, ORACLE_ABI, ETHUSD_FEED_ID, ETH_PRICE_WAD } from './lib/constants.js';
import { getWallet } from './lib/wallets.js';
import { deployerClient } from './lib/clients.js';
import { formatUnits } from 'viem';

async function main() {
  const b1 = getWallet("B1");
  const client = walletClientFor(b1);

  // Refresh oracle right before
  console.log("Refreshing oracle...");
  const oracleHash = await deployerClient.writeContract({
    address: SIMPLE_ORACLE, abi: ORACLE_ABI, functionName: "setPriceNow",
    args: [ETHUSD_FEED_ID, ETH_PRICE_WAD],
  });
  await publicClient.waitForTransactionReceipt({ hash: oracleHash });
  console.log("Oracle refreshed:", oracleHash);

  // Borrow with explicit gas limit to bypass eth_estimateGas
  console.log("Attempting borrow with explicit gas limit...");
  try {
    const hash = await client.writeContract({
      address: LENDING_POOL, abi: POOL_ABI, functionName: "borrow",
      args: [BRIDGED_ETH, usdc(80), []],
      gas: 500_000n,
    });
    console.log("Borrow submitted:", hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("Status:", receipt.status, "Gas used:", receipt.gasUsed.toString());
  } catch(e: any) {
    console.log("Error:", e.shortMessage || e.message?.slice(0, 200));
    if (e.cause?.reason) console.log("Reason:", e.cause.reason);
  }
}
main().catch(console.error);
