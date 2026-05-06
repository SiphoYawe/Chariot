// chariot/scripts/seed/generate-wallets.ts
// Generates 15 fresh wallets and writes them to scripts/seed/wallets.json
// Run once: cd chariot && npx tsx scripts/seed/generate-wallets.ts

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WALLET_ROLES = [
  "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10",
  "B1", "B2", "B3", "B4", "B5",
];

const wallets = WALLET_ROLES.map((role) => {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { role, address: account.address, privateKey };
});

const outPath = path.resolve(__dirname, "wallets.json");
fs.writeFileSync(outPath, JSON.stringify(wallets, null, 2));

console.log("Generated wallets:");
wallets.forEach((w) => console.log(`  ${w.role}: ${w.address}`));
console.log(`\nSaved to ${outPath}`);
console.log("IMPORTANT: This file contains private keys -- keep it secret.");
