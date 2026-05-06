import { publicClient, deployerClient } from './lib/clients.js';
import { LENDING_POOL, CHARIOT_VAULT, COLLATERAL_MANAGER, SIMPLE_ORACLE, BRIDGED_ETH } from './lib/constants.js';
import { getWallet } from './lib/wallets.js';
import { formatUnits } from 'viem';

const CIRCUIT_BREAKER_ABI = [
  { type: "function", name: "getLevel", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "level", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
];

const POOL_DEBUG_ABI = [
  { type: "function", name: "circuitBreaker", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "paused", inputs: [], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "getUserDebt", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
];

const COLLATERAL_DEBUG_ABI = [
  { type: "function", name: "getCollateralValueView", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getEffectiveLTV", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
];

async function main() {
  const b1 = getWallet("B1");
  
  // Check if pool is paused
  try {
    const paused = await publicClient.readContract({ address: LENDING_POOL, abi: POOL_DEBUG_ABI, functionName: "paused" });
    console.log("Pool paused:", paused);
  } catch(e) { console.log("Pool paused: error -", (e as Error).message.slice(0,100)); }

  // Get circuit breaker address
  let cbAddress: `0x${string}` | null = null;
  try {
    cbAddress = await publicClient.readContract({ address: LENDING_POOL, abi: POOL_DEBUG_ABI, functionName: "circuitBreaker" }) as `0x${string}`;
    console.log("Circuit breaker:", cbAddress);
  } catch(e) { console.log("Circuit breaker: error -", (e as Error).message.slice(0,100)); }

  // Check circuit breaker level
  if (cbAddress && cbAddress !== "0x0000000000000000000000000000000000000000") {
    try {
      const level = await publicClient.readContract({ address: cbAddress, abi: CIRCUIT_BREAKER_ABI, functionName: "level" });
      console.log("Circuit breaker level:", level);
    } catch(e) {
      try {
        const level = await publicClient.readContract({ address: cbAddress, abi: CIRCUIT_BREAKER_ABI, functionName: "getLevel" });
        console.log("Circuit breaker level:", level);
      } catch(e2) { console.log("CB level error:", (e2 as Error).message.slice(0,100)); }
    }
  }

  // Check collateral value
  try {
    const colVal = await publicClient.readContract({ address: COLLATERAL_MANAGER, abi: COLLATERAL_DEBUG_ABI, functionName: "getCollateralValueView", args: [b1.address] });
    console.log("B1 collateral value (USD):", formatUnits(colVal as bigint, 6));
  } catch(e) { console.log("Collateral value error:", (e as Error).message.slice(0,100)); }

  // Check effective LTV
  try {
    const ltv = await publicClient.readContract({ address: COLLATERAL_MANAGER, abi: COLLATERAL_DEBUG_ABI, functionName: "getEffectiveLTV" });
    console.log("Effective LTV (WAD):", formatUnits(ltv as bigint, 18));
  } catch(e) { console.log("Effective LTV error:", (e as Error).message.slice(0,100)); }
}
main().catch(console.error);
