// chariot/scripts/seed/lib/wallets.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface SeedWallet {
  role: string;
  address: `0x${string}`;
  privateKey: `0x${string}`;
  account: PrivateKeyAccount;
}

let _cache: SeedWallet[] | null = null;

export function loadWallets(): SeedWallet[] {
  if (_cache) return _cache;
  const filePath = path.resolve(__dirname, "../wallets.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`wallets.json not found at ${filePath}. Run generate-wallets.ts first.`);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Array<{
    role: string;
    address: `0x${string}`;
    privateKey: `0x${string}`;
  }>;
  _cache = raw.map((w) => {
    const account = privateKeyToAccount(w.privateKey);
    if (w.address.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error(`Wallet "${w.role}" address mismatch: JSON says ${w.address}, key derives ${account.address}`);
    }
    return { ...w, account };
  });
  return _cache;
}

export function getWallet(role: string): SeedWallet {
  const w = loadWallets().find((w) => w.role === role);
  if (!w) throw new Error(`Wallet with role "${role}" not found in wallets.json`);
  return w;
}

export function getLenders(): SeedWallet[] {
  return loadWallets().filter((w) => w.role.startsWith("L"));
}

export function getBorrowers(): SeedWallet[] {
  return loadWallets().filter((w) => w.role.startsWith("B"));
}
