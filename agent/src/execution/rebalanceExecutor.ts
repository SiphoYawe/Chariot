import { CHARIOT_ADDRESSES } from "@chariot/shared";
import type { CircleWallet } from "../wallet/circleWallet.js";
import { signAndSubmit } from "../wallet/signer.js";
import { encodeRebalanceCall } from "../wallet/permissions.js";
import { RateLimiter } from "./rateLimiter.js";
import type { ScoredAction } from "../decision/utilityCalculator.js";
import { log } from "../logger.js";

// Error classification
function isTransientError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("rpc") ||
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("502")
  );
}

export class RebalanceExecutor {
  private readonly wallet: CircleWallet;
  private readonly rateLimiter: RateLimiter;
  private consecutiveErrors = 0;

  constructor(wallet: CircleWallet, maxRebalancesPerDay: number) {
    this.wallet = wallet;
    this.rateLimiter = new RateLimiter(maxRebalancesPerDay);
  }

  async execute(action: ScoredAction, emergency: boolean): Promise<void> {
    // Emergency actions bypass rate limiter
    if (!emergency && !this.rateLimiter.canExecuteRebalance()) {
      log("info", "rebalance_deferred", {
        reason: "rate_limit",
        actionType: action.type,
        dailyCount: this.rateLimiter.getCount(),
      });
      return;
    }

    try {
      if (action.type === "move_to_usyc" || action.type === "redeem_to_usdc") {
        // ChariotVault.rebalance() handles both directions internally
        // It checks buffer target and moves capital accordingly
        const callData = encodeRebalanceCall();

        log("info", "rebalance_executing", {
          actionType: action.type,
          amount: action.amount.toString(),
          emergency,
        });

        const result = await signAndSubmit(
          this.wallet,
          CHARIOT_ADDRESSES.CHARIOT_VAULT,
          callData,
        );

        // Record successful rebalance (unless emergency -- emergencies don't count against limit)
        if (!emergency) {
          this.rateLimiter.recordRebalance();
        }

        this.consecutiveErrors = 0;

        log("info", "rebalance_executed", {
          actionType: action.type,
          amount: action.amount.toString(),
          txHash: result.txHash,
          emergency,
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.consecutiveErrors++;

      if (isTransientError(err)) {
        log("error", "rebalance_failed", {
          actionType: action.type,
          willRetry: true,
          consecutiveErrors: this.consecutiveErrors,
        }, err);
      } else {
        log("error", "rebalance_failed_permanent", {
          actionType: action.type,
          willRetry: false,
          consecutiveErrors: this.consecutiveErrors,
        }, err);
      }

      // Warn if too many consecutive errors
      if (this.consecutiveErrors > 10) {
        log("warn", "excessive_consecutive_errors", {
          count: this.consecutiveErrors,
          message: "Agent has failed >10 consecutive cycles",
        });
      }

      // Never throw -- monitoring loop must continue
    }
  }
}
