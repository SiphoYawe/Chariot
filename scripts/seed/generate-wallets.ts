// chariot/scripts/seed/generate-wallets.ts
// Generates 105 wallets (L1-L100 lenders + B1-B5 borrowers) and writes to scripts/seed/wallets.json
// Run: cd chariot && npx tsx scripts/seed/generate-wallets.ts
// Add --force to overwrite an existing wallets.json

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LENDER_ROLES = Array.from({ length: 100 }, (_, i) => `L${i + 1}`);
const BORROWER_ROLES = ["B1", "B2", "B3", "B4", "B5"];
const WALLET_ROLES = [...LENDER_ROLES, ...BORROWER_ROLES];

const outPath = path.resolve(__dirname, "wallets.json");
const force = process.argv.includes("--force");

if (fs.existsSync(outPath) && !force) {
  console.error(`ERROR: ${outPath} already exists.`);
  console.error("Run with --force to overwrite (WARNING: this replaces all wallet keys).");
  process.exit(1);
}

const wallets = WALLET_ROLES.map((role) => {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { role, address: account.address, privateKey };
});

fs.writeFileSync(outPath, JSON.stringify(wallets, null, 2), { mode: 0o600 });

console.log("Generated wallets:");
wallets.forEach((w) => console.log(`  ${w.role}: ${w.address}`));
console.log(`\nSaved to ${outPath}`);
console.log("IMPORTANT: This file contains private keys -- keep it secret.");
console.log("\nShare these addresses with the faucet (faucet.circle.com) to receive 20 USDC each:");
console.log("\nLender addresses:");
wallets.filter((w) => w.role.startsWith("L")).forEach((w) => console.log(`  ${w.address}`));
console.log("\nBorrower addresses:");
wallets.filter((w) => w.role.startsWith("B")).forEach((w) => console.log(`  ${w.address}`));
