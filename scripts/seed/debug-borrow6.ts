import { publicClient } from './lib/clients.js';
import { LENDING_POOL, CHARIOT_VAULT, COLLATERAL_MANAGER } from './lib/constants.js';
import { formatUnits } from 'viem';

const ABI = [
  { type: "function", name: "vault", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "collateralManager", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "lendingPool", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "interestRateModel", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "getTotalBorrowed", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "totalLent", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
];

const CM_ABI = [
  { type: "function", name: "lendingPool", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
];

async function main() {
  try {
    const vault = await publicClient.readContract({ address: LENDING_POOL, abi: ABI, functionName: "vault" });
    console.log("LendingPool.vault:", vault, "matches:", (vault as string).toLowerCase() === CHARIOT_VAULT.toLowerCase());
  } catch(e) { console.log("vault: error"); }

  try {
    const cm = await publicClient.readContract({ address: LENDING_POOL, abi: ABI, functionName: "collateralManager" });
    console.log("LendingPool.collateralManager:", cm, "matches:", (cm as string).toLowerCase() === COLLATERAL_MANAGER.toLowerCase());
  } catch(e) { console.log("collateralManager: error"); }

  try {
    const irm = await publicClient.readContract({ address: LENDING_POOL, abi: ABI, functionName: "interestRateModel" });
    console.log("LendingPool.interestRateModel:", irm);
  } catch(e) { console.log("interestRateModel: error"); }

  try {
    const lp = await publicClient.readContract({ address: COLLATERAL_MANAGER, abi: CM_ABI, functionName: "lendingPool" });
    console.log("CollateralManager.lendingPool:", lp, "matches:", (lp as string).toLowerCase() === LENDING_POOL.toLowerCase());
  } catch(e) { console.log("CM.lendingPool: error"); }

  try {
    const tb = await publicClient.readContract({ address: LENDING_POOL, abi: ABI, functionName: "getTotalBorrowed" });
    console.log("TotalBorrowed:", formatUnits(tb as bigint, 6));
  } catch(e) { console.log("getTotalBorrowed: error"); }

  try {
    const tl = await publicClient.readContract({ address: CHARIOT_VAULT, abi: ABI, functionName: "totalLent" });
    console.log("Vault.totalLent:", formatUnits(tl as bigint, 6));
  } catch(e) { console.log("totalLent: error"); }
}
main().catch(console.error);
