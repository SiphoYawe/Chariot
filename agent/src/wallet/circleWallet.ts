import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import type { AgentConfig } from "../config.js";
import { log } from "../logger.js";

type CircleClient = ReturnType<typeof initiateDeveloperControlledWalletsClient>;

export interface CircleWallet {
  client: CircleClient;
  walletId: string;
  walletAddress: string;
}

export async function createOrConnectWallet(config: AgentConfig): Promise<CircleWallet> {
  const client = initiateDeveloperControlledWalletsClient({
    apiKey: config.circleApiKey,
    entitySecret: config.circleEntitySecret,
  });

  // If wallet ID is already configured, reconnect
  if (config.circleWalletId) {
    log("info", "wallet_reconnect", { walletId: config.circleWalletId });

    const { data } = await client.getWallet({ id: config.circleWalletId });
    if (!data?.wallet) {
      throw new Error(`Wallet ${config.circleWalletId} not found`);
    }

    const walletAddress = data.wallet.address ?? "";
    log("info", "wallet_connected", {
      walletId: data.wallet.id,
      address: walletAddress,
    });

    return {
      client,
      walletId: data.wallet.id ?? config.circleWalletId,
      walletAddress,
    };
  }

  // Create new wallet set if needed
  let walletSetId = config.circleWalletSetId;
  if (!walletSetId) {
    log("info", "wallet_set_creating", {});

    const { data: wsData } = await client.createWalletSet({
      name: "Chariot Agent Wallet Set",
    });
    walletSetId = wsData?.walletSet?.id ?? "";
    if (!walletSetId) {
      throw new Error("Failed to create wallet set");
    }

    log("info", "wallet_set_created", { walletSetId });
  }

  // Create new SCA wallet for gas abstraction
  log("info", "wallet_creating", { walletSetId });

  const { data: walletData } = await client.createWallets({
    walletSetId,
    blockchains: ["EVM-TESTNET"],
    count: 1,
    accountType: "SCA",
  });

  const wallet = walletData?.wallets?.[0];
  if (!wallet?.id || !wallet.address) {
    throw new Error("Failed to create wallet");
  }

  log("info", "wallet_created", {
    walletId: wallet.id,
    address: wallet.address,
    note: "Add CIRCLE_WALLET_ID and CIRCLE_WALLET_SET_ID to .env for reconnection",
  });

  return {
    client,
    walletId: wallet.id,
    walletAddress: wallet.address,
  };
}
