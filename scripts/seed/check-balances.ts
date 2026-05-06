import { publicClient } from './lib/clients.js';
import { getLenders } from './lib/wallets.js';
import { USDC, ERC20_ABI } from './lib/constants.js';
import { formatUnits } from 'viem';

async function main() {
  const lenders = getLenders();
  let total = 0n;
  let funded = 0;
  for (const l of lenders) {
    const bal = await publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [l.address] }) as bigint;
    total += bal;
    if (bal > 0n) funded++;
    console.log(l.role, l.address.slice(0, 10), `$${formatUnits(bal, 6)}`);
  }
  console.log('\nFunded wallets:', funded + '/' + lenders.length);
  console.log('Total USDC across lenders: $' + formatUnits(total, 6));
}
main().catch(console.error);
