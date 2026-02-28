// Chariot Vault Management Agent
// Monitors vault state and executes rebalancing via Circle SDK

import { loadConfig } from "./config.js";
import { createOrConnectWallet } from "./wallet/circleWallet.js";
import { log } from "./logger.js";

async function main() {
  log("info", "agent_starting", { version: "0.1.0" });

  const config = loadConfig();
  log("info", "config_loaded", {
    monitorIntervalMs: config.monitorIntervalMs,
    maxRebalancesPerDay: config.maxRebalancesPerDay,
  });

  const wallet = await createOrConnectWallet(config);
  log("info", "agent_ready", {
    walletId: wallet.walletId,
    walletAddress: wallet.walletAddress,
  });

  // Monitoring loop will be wired in Story 7-2 / 7-3
  log("info", "agent_wallet_initialized", {
    message: "Wallet module ready -- monitoring loop pending Story 7-2",
  });
}

main().catch((error) => {
  log("error", "agent_fatal", {}, error);
  process.exit(1);
});
