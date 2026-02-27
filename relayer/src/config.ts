import "dotenv/config";

export const config = {
  ethSepoliaRpcUrl: process.env.ETH_SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/demo",
  arcRpcUrl: process.env.ARC_RPC_URL || "https://testnet-rpc.arc.ag",
  relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY || "",
  ethEscrowAddress: process.env.ETH_ESCROW_ADDRESS || "" as `0x${string}`,
  bridgedEthAddress: process.env.BRIDGED_ETH_ADDRESS || "" as `0x${string}`,
  stateFilePath: process.env.STATE_FILE_PATH || "./relayer-state.json",

  // Retry config
  retryBaseDelay: 1000,
  retryMaxDelay: 60_000,
  retryMultiplier: 2,
  maxRetries: 10,

  // Polling
  pollingIntervalMs: 6_000,
} as const;
