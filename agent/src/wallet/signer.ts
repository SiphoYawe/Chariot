import type { CircleWallet } from "./circleWallet.js";
import { submitGasSponsoredTransaction } from "./gasStation.js";
import { log } from "../logger.js";

interface SignAndSubmitResult {
  transactionId: string;
  txHash: string | undefined;
  status: string;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;

export async function signAndSubmit(
  wallet: CircleWallet,
  contractAddress: string,
  callData: string,
): Promise<SignAndSubmitResult> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await submitGasSponsoredTransaction(
        wallet,
        contractAddress,
        callData,
      );

      log("info", "sign_and_submit_success", {
        attempt,
        transactionId: result.transactionId,
        txHash: result.txHash,
      });

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry permission errors or permanent failures
      if (
        lastError.message.includes("not whitelisted") ||
        lastError.message.includes("DENIED") ||
        lastError.message.includes("CANCELLED")
      ) {
        log("error", "sign_and_submit_permanent_failure", {
          attempt,
          error: lastError.message,
        });
        throw lastError;
      }

      // Transient error -- retry with exponential backoff
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      log("warn", "sign_and_submit_retry", {
        attempt,
        maxRetries: MAX_RETRIES,
        error: lastError.message,
        nextRetryMs: attempt < MAX_RETRIES ? delay : undefined,
      });

      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error("signAndSubmit failed after all retries");
}
