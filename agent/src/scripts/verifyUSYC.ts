#!/usr/bin/env tsx
/**
 * USYC Verification Script
 * Tests Circle SDK connection with new API key and verifies USYC access
 */
import "dotenv/config";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { createPublicClient, http, formatUnits } from "viem";

const RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY ?? "";
const CIRCLE_ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET ?? "";
const CIRCLE_WALLET_SET_ID = process.env.CIRCLE_WALLET_SET_ID ?? "";
const CIRCLE_WALLET_ID = process.env.CIRCLE_WALLET_ID ?? "";

// Arc Testnet addresses
const USDC = "0x3600000000000000000000000000000000000000" as const;
const USYC = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C" as const;
const USYC_TELLER = "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A" as const;
const VAULT = "0x21dBa2FDC65E4910a2C34147929294f88c2D8E43" as const;

const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

const TELLER_ABI = [
  { name: "previewDeposit", type: "function", stateMutability: "view", inputs: [{ name: "usdcAmount", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "previewRedeem", type: "function", stateMutability: "view", inputs: [{ name: "usycAmount", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const;

async function main() {
  console.log("=== USYC Verification Script ===\n");

  // Step 1: Check on-chain state
  console.log("--- Step 1: On-chain USYC State ---");
  const client = createPublicClient({ chain: arcTestnet, transport: http(RPC_URL) });

  const [usycName, usycDecimals, usycSupply] = await Promise.all([
    client.readContract({ address: USYC, abi: ERC20_ABI, functionName: "name" }),
    client.readContract({ address: USYC, abi: ERC20_ABI, functionName: "decimals" }),
    client.readContract({ address: USYC, abi: ERC20_ABI, functionName: "totalSupply" }),
  ]);
  console.log(`USYC Token: ${usycName}`);
  console.log(`USYC Decimals: ${usycDecimals}`);
  console.log(`USYC Total Supply: ${formatUnits(usycSupply, usycDecimals)} USYC`);

  // Step 2: Test Teller preview functions
  console.log("\n--- Step 2: Teller Preview Functions ---");
  const testAmount = BigInt(1_000_000); // 1 USDC (6 decimals)

  const [usycFromDeposit, usdcFromRedeem] = await Promise.all([
    client.readContract({ address: USYC_TELLER, abi: TELLER_ABI, functionName: "previewDeposit", args: [testAmount] }),
    client.readContract({ address: USYC_TELLER, abi: TELLER_ABI, functionName: "previewRedeem", args: [testAmount] }),
  ]);
  console.log(`previewDeposit(1 USDC) = ${formatUnits(usycFromDeposit, 6)} USYC`);
  console.log(`previewRedeem(1 USYC) = ${formatUnits(usdcFromRedeem, 6)} USDC`);
  console.log(`USYC Price: ~${(Number(usdcFromRedeem) / 1_000_000).toFixed(6)} USDC/USYC`);

  // Step 3: Check Hashnote API for USYC price
  console.log("\n--- Step 3: Hashnote USYC Price API ---");
  try {
    const priceRes = await fetch("https://usyc.dev.hashnote.com/api/price");
    const priceData = await priceRes.json();
    console.log(`Hashnote Price: ${priceData.data.price} USDC/USYC`);
    console.log(`Next Price: ${priceData.data.nextPrice} USDC/USYC`);
  } catch (err) {
    console.log(`Hashnote API error: ${err}`);
  }

  // Step 4: Check vault USYC entitlements
  console.log("\n--- Step 4: USYC Entitlements Check ---");
  try {
    const vaultEntRes = await fetch(`https://api.dev.hashnote.com/v1/entitlements/token_access?address=${VAULT}&symbol=USYC`);
    const vaultEntData = await vaultEntRes.json();
    console.log(`Vault (${VAULT}): hasAccess = ${vaultEntData.data.hasAccess}`);
  } catch (err) {
    console.log(`Entitlements API error: ${err}`);
  }

  // Step 5: Connect to Circle SDK with new API key
  console.log("\n--- Step 5: Circle SDK Connection ---");
  if (!CIRCLE_API_KEY || !CIRCLE_ENTITY_SECRET) {
    console.log("CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET not set -- skipping SDK test");
    return;
  }

  try {
    const circleClient = initiateDeveloperControlledWalletsClient({
      apiKey: CIRCLE_API_KEY,
      entitySecret: CIRCLE_ENTITY_SECRET,
    });
    console.log("Circle SDK initialized successfully");

    // Try to reconnect to existing wallet
    if (CIRCLE_WALLET_ID) {
      console.log(`\nReconnecting to wallet: ${CIRCLE_WALLET_ID}`);
      try {
        const { data } = await circleClient.getWallet({ id: CIRCLE_WALLET_ID });
        if (data?.wallet) {
          const walletAddr = data.wallet.address ?? "unknown";
          console.log(`Wallet address: ${walletAddr}`);
          console.log(`Wallet state: ${data.wallet.state}`);
          console.log(`Blockchain: ${data.wallet.blockchain}`);

          // Check USYC entitlements for this wallet
          try {
            const walletEntRes = await fetch(`https://api.dev.hashnote.com/v1/entitlements/token_access?address=${walletAddr}&symbol=USYC`);
            const walletEntData = await walletEntRes.json();
            console.log(`Circle Wallet USYC access: ${walletEntData.data.hasAccess}`);
          } catch {
            console.log("Could not check wallet entitlements");
          }

          // Check wallet balances
          const [walletUSDC, walletUSYC] = await Promise.all([
            client.readContract({ address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [walletAddr as `0x${string}`] }),
            client.readContract({ address: USYC, abi: ERC20_ABI, functionName: "balanceOf", args: [walletAddr as `0x${string}`] }),
          ]);
          console.log(`Wallet USDC: ${formatUnits(walletUSDC, 6)} USDC`);
          console.log(`Wallet USYC: ${formatUnits(walletUSYC, 6)} USYC`);
        }
      } catch (err) {
        console.log(`Failed to get wallet: ${err}`);
      }
    }

    // List all wallet sets
    console.log("\n--- Listing Wallet Sets ---");
    try {
      const { data: wsData } = await circleClient.listWalletSets({ });
      if (wsData?.walletSets && wsData.walletSets.length > 0) {
        for (const ws of wsData.walletSets) {
          console.log(`  WalletSet: ${ws.id}`);
        }
      } else {
        console.log("  No wallet sets found");
      }
    } catch (err) {
      console.log(`  Failed to list wallet sets: ${err}`);
    }

    // List wallets
    console.log("\n--- Listing Wallets ---");
    try {
      const { data: wData } = await circleClient.listWallets({ });
      if (wData?.wallets && wData.wallets.length > 0) {
        for (const w of wData.wallets) {
          console.log(`  Wallet: ${w.id} | ${w.address} | ${w.blockchain} | ${w.state}`);

          // Check each wallet's USYC entitlements
          if (w.address) {
            try {
              const entRes = await fetch(`https://api.dev.hashnote.com/v1/entitlements/token_access?address=${w.address}&symbol=USYC`);
              const entData = await entRes.json();
              console.log(`    USYC access: ${entData.data.hasAccess}`);
            } catch {
              console.log("    Could not check entitlements");
            }
          }
        }
      } else {
        console.log("  No wallets found");
      }
    } catch (err) {
      console.log(`  Failed to list wallets: ${err}`);
    }

  } catch (err) {
    console.log(`Circle SDK error: ${err}`);
    console.log("\nThis may indicate the entity secret needs to be regenerated for the new API key.");
    console.log("Run the entity secret registration process for the new API key.");
  }

  console.log("\n=== Verification Complete ===");
}

main().catch(console.error);
