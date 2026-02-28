// Chariot Vault Management Agent
// Monitors vault state and executes rebalancing via Circle SDK

import { loadConfig } from "./config.js";
import { createOrConnectWallet } from "./wallet/circleWallet.js";
import { validateAddresses } from "./wallet/permissions.js";
import { runMonitorLoop } from "./monitor/monitorLoop.js";
import type { ScoredAction } from "./decision/utilityCalculator.js";
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

  // Placeholder executeAction -- will be replaced by rebalanceExecutor in Story 7-3
  const executeAction = async (action: ScoredAction, emergency: boolean): Promise<void> => {
    log("info", "action_pending_executor", {
      type: action.type,
      amount: action.amount.toString(),
      emergency,
      note: "Execution module pending Story 7-3",
    });
  };

  // Start monitoring loop
  await runMonitorLoop({ config, wallet, executeAction });
}

main().catch((error) => {
  log("error", "agent_fatal", {}, error);
  process.exit(1);
});
