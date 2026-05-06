import { publicClient } from './lib/clients.js';
import { COLLATERAL_MANAGER, LENDING_POOL, SIMPLE_ORACLE, BRIDGED_ETH } from './lib/constants.js';
import { getWallet } from './lib/wallets.js';
import { formatUnits } from 'viem';

const ABI = [
  { type: "function", name: "storkOracle", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "getETHPrice", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getUserCollateral", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
];
const POOL_ABI2 = [
  { type: "function", name: "storkOracle", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "vault", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
];

async function main() {
  const b1 = getWallet("B1");

  const cmOracle = await publicClient.readContract({ address: COLLATERAL_MANAGER, abi: ABI, functionName: "storkOracle" });
  console.log("CollateralManager.storkOracle:", cmOracle);
  console.log("Expected SimpleOracle:", SIMPLE_ORACLE);
  console.log("Match:", (cmOracle as string).toLowerCase() === SIMPLE_ORACLE.toLowerCase());

  const ethPrice = await publicClient.readContract({ address: COLLATERAL_MANAGER, abi: ABI, functionName: "getETHPrice" });
  console.log("ETH price (WAD):", formatUnits(ethPrice as bigint, 18), "USD");

  const colAmount = await publicClient.readContract({ address: COLLATERAL_MANAGER, abi: ABI, functionName: "getUserCollateral", args: [b1.address, BRIDGED_ETH] });
  console.log("B1 collateral amount:", formatUnits(colAmount as bigint, 18), "ETH");

  try {
    const poolOracle = await publicClient.readContract({ address: LENDING_POOL, abi: POOL_ABI2, functionName: "storkOracle" });
    console.log("LendingPool.storkOracle:", poolOracle);
  } catch(e) { console.log("pool storkOracle: error"); }

  try {
    const vault = await publicClient.readContract({ address: LENDING_POOL, abi: POOL_ABI2, functionName: "vault" });
    console.log("LendingPool.vault:", vault);
  } catch(e) { console.log("pool vault: error"); }
}
main().catch(console.error);
