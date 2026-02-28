import type { CircleWallet } from "./circleWallet.js";
import { isCallAllowed } from "./permissions.js";
import { log } from "../logger.js";
import crypto from "node:crypto";

interface TransactionResult {
  transactionId: string;
  txHash: string | undefined;
  status: string;
}

// Poll for transaction completion with timeout
async function waitForTransaction(
  wallet: CircleWallet,
  transactionId: string,
  maxWaitMs = 60_000,
): Promise<TransactionResult> {
  const startTime = Date.now();
  const pollIntervalMs = 2_000;

  while (Date.now() - startTime < maxWaitMs) {
    const { data } = await wallet.client.getTransaction({ id: transactionId });
    const tx = data?.transaction;

    if (!tx) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const state = tx.state ?? "UNKNOWN";
    if (state === "COMPLETE" || state === "CONFIRMED") {
      return {
        transactionId,
        txHash: tx.txHash,
        status: state,
      };
    }

    if (state === "FAILED" || state === "DENIED" || state === "CANCELLED" || state === "STUCK") {
      throw new Error(`Transaction ${transactionId} ended with status: ${state}`);
    }

    // Still pending -- wait and retry
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Transaction ${transactionId} timed out after ${maxWaitMs}ms`);
}

export async function submitGasSponsoredTransaction(
  wallet: CircleWallet,
  contractAddress: string,
  callData: string,
): Promise<TransactionResult> {
  // Pre-transaction permission validation
  if (!isCallAllowed(contractAddress, callData)) {
    throw new Error(`Call to ${contractAddress} with selector ${callData.slice(0, 10)} is not whitelisted`);
  }

  log("info", "tx_submitting", {
    contractAddress,
    functionSelector: callData.slice(0, 10),
  });

  // Submit contract execution via Circle SDK
  // Gas Station automatically sponsors gas for SCA wallets on supported chains
  // Uses callData mode (mutually exclusive with abiFunctionSignature in the SDK)
  const { data } = await wallet.client.createContractExecutionTransaction({
    walletId: wallet.walletId,
    contractAddress,
    callData: callData as `0x${string}`,
    fee: {
      type: "level",
      config: { feeLevel: "MEDIUM" },
    },
    idempotencyKey: crypto.randomUUID(),
  });

  const transactionId = data?.id;
  if (!transactionId) {
    throw new Error("Failed to submit transaction -- no transaction ID returned");
  }

  log("info", "tx_submitted", { transactionId });

  // Wait for transaction confirmation
  const result = await waitForTransaction(wallet, transactionId);

  log("info", "tx_confirmed", {
    transactionId: result.transactionId,
    txHash: result.txHash,
    status: result.status,
  });

  return result;
}
