import { encodeFunctionData, toFunctionSelector } from "viem";
import { ADDRESSES, CHARIOT_ADDRESSES, ChariotVaultABI } from "@chariot/shared";
import { log } from "../logger.js";

// Compute selectors from ABI at module load -- never hardcode
const REBALANCE_SELECTOR = toFunctionSelector("function rebalance()");
const TELLER_DEPOSIT_SELECTOR = toFunctionSelector("function deposit(uint256)");
const TELLER_REDEEM_SELECTOR = toFunctionSelector("function redeem(uint256)");

// Build whitelist lazily so we can validate addresses at call time
function getAllowedCalls(): Map<string, Set<string>> {
  return new Map([
    [
      CHARIOT_ADDRESSES.CHARIOT_VAULT.toLowerCase(),
      new Set([REBALANCE_SELECTOR]),
    ],
    [
      ADDRESSES.USYC_TELLER.toLowerCase(),
      new Set([TELLER_DEPOSIT_SELECTOR, TELLER_REDEEM_SELECTOR]),
    ],
  ]);
}

export function validateAddresses(): void {
  if (!CHARIOT_ADDRESSES.CHARIOT_VAULT || CHARIOT_ADDRESSES.CHARIOT_VAULT === ("" as `0x${string}`)) {
    throw new Error("CHARIOT_VAULT address is not configured in shared/addresses.ts");
  }
}

export function isCallAllowed(contractAddress: string, callData: string): boolean {
  const normalizedAddress = contractAddress.toLowerCase();
  const functionSelector = callData.slice(0, 10).toLowerCase();

  const allowedCalls = getAllowedCalls();
  const allowedSelectors = allowedCalls.get(normalizedAddress);
  if (!allowedSelectors) {
    log("warn", "permission_denied", {
      reason: "contract_not_whitelisted",
      contractAddress,
    });
    return false;
  }

  if (!allowedSelectors.has(functionSelector)) {
    log("warn", "permission_denied", {
      reason: "function_not_whitelisted",
      contractAddress,
      functionSelector,
    });
    return false;
  }

  return true;
}

// Pre-encode rebalance calldata for convenience
export function encodeRebalanceCall(): `0x${string}` {
  return encodeFunctionData({
    abi: ChariotVaultABI,
    functionName: "rebalance",
  });
}
