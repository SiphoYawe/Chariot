import { publicClient } from './lib/clients.js';
import { USDC, ERC20_ABI, BRIDGED_ETH, BRIDGED_ETH_ABI } from './lib/constants.js';
import { getWallet } from './lib/wallets.js';
import { formatUnits } from 'viem';

async function main() {
  for (const role of ["B1", "B2", "B3"]) {
    const w = getWallet(role);
    const usdc = await publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [w.address] }) as bigint;
    const eth = await publicClient.readContract({ address: BRIDGED_ETH, abi: BRIDGED_ETH_ABI, functionName: "balanceOf", args: [w.address] }) as bigint;
    console.log(role, "USDC:", formatUnits(usdc, 6), "BridgedETH:", formatUnits(eth, 18));
  }
}
main().catch(console.error);
