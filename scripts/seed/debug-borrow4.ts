import { publicClient } from './lib/clients.js';
import { CHARIOT_VAULT, USDC, ERC20_ABI, VAULT_ABI } from './lib/constants.js';
import { formatUnits } from 'viem';

async function main() {
  // Check vault's raw USDC balance (what lend() can use)
  const rawBal = await publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [CHARIOT_VAULT] }) as bigint;
  console.log("Vault raw USDC balance (idle):", formatUnits(rawBal, 6));

  // Check totalAssets
  const totalAssets = await publicClient.readContract({ address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "totalAssets" }) as bigint;
  console.log("Vault totalAssets:", formatUnits(totalAssets, 6));

  // Check totalSupply
  const totalSupply = await publicClient.readContract({ address: CHARIOT_VAULT, abi: VAULT_ABI, functionName: "totalSupply" }) as bigint;
  console.log("Vault totalSupply (shares):", formatUnits(totalSupply, 18));
}
main().catch(console.error);
