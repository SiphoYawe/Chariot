import { publicClient, walletClientFor } from './lib/clients.js';
import { LENDING_POOL, BRIDGED_ETH, POOL_ABI, usdc } from './lib/constants.js';
import { getWallet } from './lib/wallets.js';
import { decodeErrorResult } from 'viem';

const POOL_ABI_FULL = [
  { type: "function", name: "borrow", inputs: [{ name: "collateralToken", type: "address" }, { name: "amount", type: "uint256" }, { name: "priceUpdates", type: "tuple[]", components: [] }], outputs: [], stateMutability: "nonpayable" },
  { type: "error", name: "ZeroAmount", inputs: [] },
  { type: "error", name: "ExceedsLTV", inputs: [] },
  { type: "error", name: "HealthFactorTooLow", inputs: [] },
  { type: "error", name: "BorrowingPaused", inputs: [] },
  { type: "error", name: "ExceedsAvailable", inputs: [{ type: "uint256" }, { type: "uint256" }] },
  { type: "error", name: "ZeroAddress", inputs: [] },
];

async function main() {
  const b1 = getWallet("B1");
  
  try {
    const result = await publicClient.simulateContract({
      address: LENDING_POOL,
      abi: POOL_ABI_FULL,
      functionName: "borrow",
      args: [BRIDGED_ETH, usdc(80), []],
      account: b1.account,
    });
    console.log("Simulate SUCCESS:", result);
  } catch(e: any) {
    console.log("Simulate error name:", e.cause?.name || e.name);
    console.log("Simulate error:", e.cause?.message || e.message);
    if (e.cause?.data) {
      try {
        const decoded = decodeErrorResult({ abi: POOL_ABI_FULL, data: e.cause.data });
        console.log("Decoded error:", decoded);
      } catch { console.log("Raw error data:", e.cause.data); }
    }
  }
}
main().catch(console.error);
