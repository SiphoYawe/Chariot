import { createPublicClient, http, type PublicClient } from "viem";
import { ARC_CHAIN_ID } from "@chariot/shared";
import type { AgentConfig } from "./config.js";

let client: PublicClient | null = null;

export function getPublicClient(config: AgentConfig): PublicClient {
  if (!client) {
    client = createPublicClient({
      chain: {
        id: ARC_CHAIN_ID,
        name: "Arc Testnet",
        nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
        rpcUrls: { default: { http: [config.arcRpcUrl] } },
      },
      transport: http(config.arcRpcUrl),
    });
  }
  return client;
}
