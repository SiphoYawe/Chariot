import type { ScoredAction } from "./utilityCalculator.js";
import { log } from "../logger.js";

export function selectBestAction(
  rankedActions: ScoredAction[],
  minimumThreshold: number,
): ScoredAction {
  const best = rankedActions[0];

  // Log all utility scores for observability
  log("info", "decision_evaluated", {
    utilityScores: rankedActions.map((a) => ({
      type: a.type,
      utility: a.utility,
      amount: a.amount.toString(),
    })),
    threshold: minimumThreshold,
  });

  if (!best || best.utility <= minimumThreshold) {
    log("info", "decision_do_nothing", {
      reason: "No action above minimum utility threshold",
      bestUtility: best?.utility ?? 0,
      threshold: minimumThreshold,
    });

    return {
      type: "do_nothing",
      utility: 0,
      amount: 0n,
      reason: "No action above threshold",
    };
  }

  log("info", "decision_selected", {
    selectedAction: best.type,
    utility: best.utility,
    amount: best.amount.toString(),
    reason: best.reason,
  });

  return best;
}
