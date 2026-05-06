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
  const content = fs.readFileSync(envPath, "utf-8");
  return Object.fromEntries(
    content
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const idx = l.indexOf("=");
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
      })
  );
}

const env = loadEnv();

export const DEPLOYER_KEY = env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
if (!DEPLOYER_KEY) throw new Error("DEPLOYER_PRIVATE_KEY not set in contracts/.env");

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
