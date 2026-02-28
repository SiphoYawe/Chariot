import type { VaultState } from "../monitor/vaultMonitor.js";
import { RATE_MODEL, USDC_ERC20_DECIMALS } from "@chariot/shared";

export type ActionType = "move_to_usyc" | "redeem_to_usdc" | "do_nothing";

export interface ScoredAction {
  type: ActionType;
  utility: number;
  amount: bigint;
  reason: string;
}

// WAD precision helpers
const WAD = 10n ** 18n;
const USDC_UNIT = 10n ** BigInt(USDC_ERC20_DECIMALS);

// Buffer target: 5% of total assets in USDC
const BUFFER_PERCENT_WAD = (5n * WAD) / 100n;

// Expected hold duration in years (for yield calculation) -- assume 30 days
const EXPECTED_DURATION_YEARS = 30 / 365;

// Risk factor for early redemption
const REDEMPTION_RISK = 0.1;
const PROBABILITY_EARLY_REDEEM = 0.2;

// Estimated gas cost in USDC (6 decimals) -- conservative estimate
const GAS_COST_USDC = 0.5;

function bigintToNumber(value: bigint, decimals: number): number {
  return Number(value) / 10 ** decimals;
}

export function calculateMoveToUSYC(state: VaultState): ScoredAction {
  // How much idle USDC above the 5% buffer can be moved to USYC
  const bufferTarget = (state.totalAssets * BUFFER_PERCENT_WAD) / WAD;
  const excessIdle = state.idleUSDC > bufferTarget ? state.idleUSDC - bufferTarget : 0n;

  if (excessIdle === 0n) {
    return {
      type: "move_to_usyc",
      utility: -1,
      amount: 0n,
      reason: "No excess idle USDC above buffer target",
    };
  }

  const amountUSDC = bigintToNumber(excessIdle, USDC_ERC20_DECIMALS);
  // Net yield after strategy fee: USYC_Yield * (1 - STRATEGY_FEE)
  const netYieldRate = state.usycYieldRate * (1 - RATE_MODEL.STRATEGY_FEE);
  const yieldGain = netYieldRate * amountUSDC * EXPECTED_DURATION_YEARS;
  const riskCost = REDEMPTION_RISK * PROBABILITY_EARLY_REDEEM * amountUSDC;
  const utility = yieldGain - riskCost - GAS_COST_USDC;

  return {
    type: "move_to_usyc",
    utility,
    amount: excessIdle,
    reason: `Yield gain: ${yieldGain.toFixed(4)}, Risk cost: ${riskCost.toFixed(4)}, Gas: ${GAS_COST_USDC}`,
  };
}

export function calculateRedeemToUSDC(state: VaultState): ScoredAction {
  // Check if idle USDC is below the buffer target
  const bufferTarget = (state.totalAssets * BUFFER_PERCENT_WAD) / WAD;

  if (state.idleUSDC >= bufferTarget || state.usycBalance === 0n) {
    return {
      type: "redeem_to_usdc",
      utility: -1,
      amount: 0n,
      reason: "Idle USDC meets buffer target or no USYC to redeem",
    };
  }

  // Need to redeem enough USYC to restore buffer
  const shortfall = bufferTarget - state.idleUSDC;
  // Cap redemption at available USYC balance
  const redeemAmount = shortfall < state.usycBalance ? shortfall : state.usycBalance;

  // Utility is high when buffer is critically low -- withdrawal demand creates urgency
  const bufferRatio = state.idleUSDC > 0n
    ? bigintToNumber(state.idleUSDC, USDC_ERC20_DECIMALS) / bigintToNumber(bufferTarget, USDC_ERC20_DECIMALS)
    : 0;

  // Lower buffer ratio = higher urgency = higher utility
  const urgencyMultiplier = Math.max(0, 1 - bufferRatio) * 10;
  const utility = urgencyMultiplier - GAS_COST_USDC;

  return {
    type: "redeem_to_usdc",
    utility,
    amount: redeemAmount,
    reason: `Buffer ratio: ${(bufferRatio * 100).toFixed(2)}%, Urgency: ${urgencyMultiplier.toFixed(4)}`,
  };
}

export function calculateDoNothing(): ScoredAction {
  return {
    type: "do_nothing",
    utility: 0,
    amount: 0n,
    reason: "Baseline action",
  };
}

export function rankActions(state: VaultState): ScoredAction[] {
  const actions = [
    calculateMoveToUSYC(state),
    calculateRedeemToUSDC(state),
    calculateDoNothing(),
  ];

  // Sort by utility descending
  return actions.sort((a, b) => b.utility - a.utility);
}
