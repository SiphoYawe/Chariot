import { publicClient } from './lib/clients.js';
import { LENDING_POOL, COLLATERAL_MANAGER, BRIDGED_ETH } from './lib/constants.js';
import { getWallet, getBorrowers } from './lib/wallets.js';
import { formatUnits } from 'viem';

const POOL_ABI = [
  { type: "function", name: "getUserDebt", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getTotalBorrowed", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
];
const CM_ABI = [
  { type: "function", name: "getCollateralBalance", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getCollateralValueView", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
];

async function main() {
  const tb = await publicClient.readContract({ address: LENDING_POOL, abi: POOL_ABI, functionName: "getTotalBorrowed" }) as bigint;
  console.log("TotalBorrowed:", formatUnits(tb, 6));

  for (const b of getBorrowers()) {
    const debt = await publicClient.readContract({ address: LENDING_POOL, abi: POOL_ABI, functionName: "getUserDebt", args: [b.address] }) as bigint;
    let colBal = 0n;
    let colVal = 0n;
    try {
      colBal = await publicClient.readContract({ address: COLLATERAL_MANAGER, abi: CM_ABI, functionName: "getCollateralBalance", args: [b.address, BRIDGED_ETH] }) as bigint;
      colVal = await publicClient.readContract({ address: COLLATERAL_MANAGER, abi: CM_ABI, functionName: "getCollateralValueView", args: [b.address] }) as bigint;
    } catch(e) {}
    console.log(b.role, "debt:", formatUnits(debt, 6), "collateral:", formatUnits(colBal, 18), "ETH value:", formatUnits(colVal, 6));
  }
}
main().catch(console.error);
