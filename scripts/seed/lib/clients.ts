// chariot/scripts/seed/lib/clients.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "./constants.js";
import type { SeedWallet } from "./wallets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, "../../../contracts/.env");
  if (!fs.existsSync(envPath)) {
    throw new Error(
      `contracts/.env not found at ${envPath}. Copy contracts/.env.example and fill in DEPLOYER_PRIVATE_KEY.`
    );
  }
  const content = fs.readFileSync(envPath, "utf-8");
  return Object.fromEntries(
    content
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const idx = l.indexOf("=");
        const key = l.slice(0, idx).trim();
        const val = l.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
        return [key, val];
      })
  );
}

const env = loadEnv();

export const DEPLOYER_KEY = env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
if (!DEPLOYER_KEY || DEPLOYER_KEY.length < 66) {
  throw new Error("DEPLOYER_PRIVATE_KEY in contracts/.env is missing or malformed (expected 0x + 64 hex chars)");
}

export const deployerAccount = privateKeyToAccount(DEPLOYER_KEY);

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http("https://rpc.blockdaemon.testnet.arc.network"),
});

export const deployerClient = createWalletClient({
  account: deployerAccount,
  chain: arcTestnet,
  transport: http("https://rpc.blockdaemon.testnet.arc.network"),
});

export function walletClientFor(wallet: SeedWallet) {
  return createWalletClient({
    account: wallet.account,
    chain: arcTestnet,
    transport: http("https://rpc.blockdaemon.testnet.arc.network"),
  });
}
