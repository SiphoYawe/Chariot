// chariot/scripts/seed/fund-wallets.ts
// One-shot: deployer funds all 15 wallets with USDC and BridgedETH.
// Run: cd chariot && npx tsx scripts/seed/fund-wallets.ts

import { formatUnits } from "viem";
import {
  USDC, BRIDGED_ETH, SIMPLE_ORACLE,
  ETHUSD_FEED_ID, ETH_PRICE_WAD,
  ERC20_ABI, BRIDGED_ETH_ABI, ORACLE_ABI,
  usdc, eth,
} from "./lib/constants.js";
import { publicClient, deployerClient, deployerAccount } from "./lib/clients.js";
import { getLenders, getBorrowers } from "./lib/wallets.js";
import { execTx, sleep } from "./lib/tx.js";
import { banner } from "./lib/logger.js";

// Borrower collateral amounts and mint nonces (offset by 5000 to avoid collision with prior seeds)
const BORROWER_CONFIG = [
  { role: "B1", ethAmount: eth(0.2), nonce: 5001n },
  { role: "B2", ethAmount: eth(0.2), nonce: 5002n },
  { role: "B3", ethAmount: eth(0.2), nonce: 5003n },
  { role: "B4", ethAmount: eth(0.2), nonce: 5004n },
  { role: "B5", ethAmount: eth(0.15), nonce: 5005n },
];

async function main() {
  banner("Fund Wallets -- Deployer Pre-funding");

  const lenders = getLenders();
  const borrowers = getBorrowers();

  // Check deployer USDC balance
  const deployerBal = await publicClient.readContract({
    address: USDC, abi: ERC20_ABI, functionName: "balanceOf",
    args: [deployerAccount.address],
  });
  console.log(`Deployer USDC balance: $${formatUnits(deployerBal, 6)}`);

  const totalNeeded = usdc(22) * BigInt(lenders.length) + usdc(2) * BigInt(borrowers.length);
  console.log(`Total USDC needed for gas funding: $${formatUnits(totalNeeded, 6)}`);
  if (deployerBal < totalNeeded + usdc(5)) {
    throw new Error(`Deployer has insufficient USDC. Need $${formatUnits(totalNeeded + usdc(5), 6)}, have $${formatUnits(deployerBal, 6)}`);
  }

  // 1. Fund lenders: 22 USDC each (20 to deposit + 2 gas)
  banner("Funding Lender Wallets");
  for (const lender of lenders) {
    await execTx(
      `Transfer 22 USDC to lender ${lender.role} (${lender.address.slice(0, 8)}...)`,
      deployerClient,
      { address: USDC, abi: ERC20_ABI, functionName: "transfer", args: [lender.address, usdc(22)] }
    );
    await sleep(1000);
  }

  // 2. Fund borrowers: 2 USDC gas buffer each
  banner("Funding Borrower Wallets (gas only)");
  for (const borrower of borrowers) {
    await execTx(
      `Transfer 2 USDC gas to borrower ${borrower.role} (${borrower.address.slice(0, 8)}...)`,
      deployerClient,
      { address: USDC, abi: ERC20_ABI, functionName: "transfer", args: [borrower.address, usdc(2)] }
    );
    await sleep(1000);
  }

  // 3. Mint BridgedETH to borrowers
  banner("Minting BridgedETH to Borrower Wallets");
  for (const cfg of BORROWER_CONFIG) {
    const borrower = borrowers.find((b) => b.role === cfg.role);
    if (!borrower) throw new Error(`Borrower wallet ${cfg.role} not found`);
    await execTx(
      `Mint ${formatUnits(cfg.ethAmount, 18)} BridgedETH to ${cfg.role} (nonce=${cfg.nonce})`,
      deployerClient,
      { address: BRIDGED_ETH, abi: BRIDGED_ETH_ABI, functionName: "mint", args: [borrower.address, cfg.ethAmount, cfg.nonce] }
    );
    await sleep(1000);
  }

  // 4. Refresh oracle
  banner("Refreshing Oracle Price");
  await execTx("Set ETHUSD oracle price to $2,500", deployerClient, {
    address: SIMPLE_ORACLE, abi: ORACLE_ABI, functionName: "setPriceNow",
    args: [ETHUSD_FEED_ID, ETH_PRICE_WAD],
  });

  banner("Funding Complete");
  console.log("Next step: run accumulate.ts to start the lender deposit loop.");
}

main().catch((e) => { console.error(e); process.exit(1); });
