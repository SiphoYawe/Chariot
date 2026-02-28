import {
  publicClient,
  sendDeployerTx,
  CHARIOT_ADDRESSES,
  ChariotVaultABI,
  CircuitBreakerABI,
} from "../setup.js";

export const name = "Circuit Breaker";

export async function run(): Promise<void> {
  const levelBefore = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "circuitBreakerLevel",
  })) as number;
  console.log(`    Circuit breaker level before: ${levelBefore}`);

  await sendDeployerTx({
    to: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: CircuitBreakerABI,
    functionName: "triggerCircuitBreaker",
    args: [1],
  });

  const levelAfter = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "circuitBreakerLevel",
  })) as number;
  if (levelAfter !== 1) {
    throw new Error(`Circuit breaker level not 1 after trigger: ${levelAfter}`);
  }
  console.log(`    Circuit breaker level after trigger: ${levelAfter}`);

  await sendDeployerTx({
    to: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: CircuitBreakerABI,
    functionName: "resumeCircuitBreaker",
  });

  const levelFinal = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.CHARIOT_VAULT,
    abi: ChariotVaultABI,
    functionName: "circuitBreakerLevel",
  })) as number;
  if (levelFinal !== 0) {
    throw new Error(`Circuit breaker not reset: ${levelFinal}`);
  }
  console.log(`    Circuit breaker level after resume: ${levelFinal}`);
}
