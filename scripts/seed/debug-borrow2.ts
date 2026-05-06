import { publicClient } from './lib/clients.js';
import { LENDING_POOL, CHARIOT_VAULT } from './lib/constants.js';
import { keccak256, toHex } from 'viem';

const VAULT_ABI = [
  { type: "function", name: "hasRole", inputs: [{ type: "bytes32" }, { type: "address" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "paused", inputs: [], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "totalAssets", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
];

async function main() {
  const LENDING_POOL_ROLE = keccak256(toHex("LENDING_POOL_ROLE"));
  console.log("LENDING_POOL_ROLE:", LENDING_POOL_ROLE);

  const hasRole = await publicClient.readContract({
    address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "hasRole",
    args: [LENDING_POOL_ROLE, LENDING_POOL],
  });
  console.log("LendingPool has LENDING_POOL_ROLE on vault:", hasRole);

  try {
    const paused = await publicClient.readContract({ address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "paused" });
    console.log("Vault paused:", paused);
  } catch(e) { console.log("Vault paused check error"); }
}
main().catch(console.error);
