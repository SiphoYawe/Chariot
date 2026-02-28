import { writeFileSync } from "node:fs";
import type { AgentConfig } from "../config.js";
import type { CircleWallet } from "../wallet/circleWallet.js";
import { readOnChainState } from "./vaultMonitor.js";
import { getCircuitBreakerLevel, isEmergency } from "./circuitBreakerMonitor.js";
import { rankActions, type ScoredAction } from "../decision/utilityCalculator.js";
import { selectBestAction } from "../decision/decisionEngine.js";
import { log } from "../logger.js";

const HEARTBEAT_PATH = "/tmp/chariot-heartbeat";

export interface MonitorContext {
  config: AgentConfig;
  wallet: CircleWallet;
  executeAction: (action: ScoredAction, emergency: boolean) => Promise<void>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runMonitorLoop(ctx: MonitorContext): Promise<void> {
  log("info", "monitor_loop_starting", {
    intervalMs: ctx.config.monitorIntervalMs,
  });

  // Graceful shutdown handling
  let running = true;
  const shutdown = () => {
    log("info", "monitor_loop_shutdown_requested", {});
    running = false;
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  while (running) {
    try {
      // Step 1: Check circuit breaker FIRST -- highest priority
      const cbLevel = await getCircuitBreakerLevel(ctx.config);

      if (isEmergency(cbLevel)) {
        // Emergency: redeem all USYC to USDC immediately
        log("warn", "emergency_response_triggered", { circuitBreakerLevel: cbLevel });

        const state = await readOnChainState(ctx.config);
        if (state.usycBalance > 0n) {
          const emergencyAction: ScoredAction = {
            type: "redeem_to_usdc",
            utility: Number.MAX_SAFE_INTEGER,
            amount: state.usycBalance,
            reason: "Emergency circuit breaker -- redeem all USYC",
          };
          await ctx.executeAction(emergencyAction, true);
        }
      } else {
        // Step 2: Read vault state
        const state = await readOnChainState(ctx.config);

        // Step 3: Calculate best action
        const rankedActions = rankActions(state);
        const bestAction = selectBestAction(rankedActions, ctx.config.minimumUtilityThreshold);

        // Step 4: Execute if not "do_nothing"
        if (bestAction.type !== "do_nothing") {
          await ctx.executeAction(bestAction, false);
        }
      }
      // Write heartbeat after each successful cycle
      try {
        writeFileSync(HEARTBEAT_PATH, String(Date.now()));
      } catch {
        // Heartbeat file write failure is non-critical
      }
    } catch (error) {
      log("error", "monitor_cycle_error", {}, error);
      // Never crash -- continue monitoring
    }

    if (running) {
      await sleep(ctx.config.monitorIntervalMs);
    }
  }

  // Cleanup signal handlers
  process.removeListener("SIGTERM", shutdown);
  process.removeListener("SIGINT", shutdown);
  log("info", "monitor_loop_stopped", {});
}
