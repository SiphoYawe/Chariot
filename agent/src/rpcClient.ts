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
        contracts: {
          multicall3: {
            address: "0xcA11bde05977b3631167028862bE2a173976CA11",
          },
        },
      },
      transport: http(config.arcRpcUrl),
    });
  }
  return client;
}
