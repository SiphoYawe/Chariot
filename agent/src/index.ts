// Chariot Vault Management Agent
// Monitors vault state and executes rebalancing via Circle SDK

import { loadConfig } from "./config.js";
import { createOrConnectWallet } from "./wallet/circleWallet.js";
import { validateAddresses } from "./wallet/permissions.js";
import { runMonitorLoop } from "./monitor/monitorLoop.js";
import { RebalanceExecutor } from "./execution/rebalanceExecutor.js";
import { log } from "./logger.js";

async function main() {
  log("info", "agent_starting", { version: "0.1.0" });

  const config = loadConfig();
  log("info", "config_loaded", {
    monitorIntervalMs: config.monitorIntervalMs,
    maxRebalancesPerDay: config.maxRebalancesPerDay,
  });

  // Validate contract addresses are configured
  validateAddresses();

  const wallet = await createOrConnectWallet(config);
  log("info", "agent_ready", {
    walletId: wallet.walletId,
    walletAddress: wallet.walletAddress,
  });

  // Create the rebalance executor with rate limiting
  const executor = new RebalanceExecutor(wallet, config.maxRebalancesPerDay);

  // Start monitoring loop with real executor
  await runMonitorLoop({
    config,
    wallet,
    executeAction: (action, emergency) => executor.execute(action, emergency),
  });
}

main().catch((error) => {
  log("error", "agent_fatal", {}, error);
  process.exit(1);
});
