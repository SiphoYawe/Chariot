import { CHARIOT_ADDRESSES, CircuitBreakerABI } from "@chariot/shared";
import type { CircuitBreakerLevel } from "@chariot/shared";
import type { AgentConfig } from "../config.js";
import { getPublicClient } from "../rpcClient.js";
import { log } from "../logger.js";

export async function getCircuitBreakerLevel(config: AgentConfig): Promise<CircuitBreakerLevel> {
  const client = getPublicClient(config);

  // circuitBreakerLevel is on ChariotVault (inherits from ChariotBase)
  const vaultAddress = CHARIOT_ADDRESSES.CHARIOT_VAULT;

  const level = await client.readContract({
    address: vaultAddress,
    abi: CircuitBreakerABI,
    functionName: "circuitBreakerLevel",
  });

  const rawLevel = Number(level);

  // Bounds check -- treat unexpected values as emergency (fail-safe)
  if (rawLevel < 0 || rawLevel > 3) {
    log("warn", "circuit_breaker_unexpected_level", {
      rawLevel,
      treatingAs: 3,
    });
    return 3;
  }

  const cbLevel = rawLevel as CircuitBreakerLevel;

  if (cbLevel > 0) {
    log("warn", "circuit_breaker_active", { level: cbLevel });
  }

  return cbLevel;
}

export function isEmergency(level: CircuitBreakerLevel): boolean {
  return level >= 3;
}
