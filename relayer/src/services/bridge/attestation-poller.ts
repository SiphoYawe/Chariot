import { logger } from "../../logger";

// Circle CCTP Attestation API (sandbox)
const ATTESTATION_API_BASE = "https://iris-api-sandbox.circle.com";

export type BridgeStatus = "sent" | "pending_attestation" | "complete";

export interface BridgeTransaction {
  transactionHash: string;
  messageHash?: string;
  nonce: bigint;
  sender: string;
  destinationDomain: number;
  amount: bigint;
  status: BridgeStatus;
  createdAt: number;
  completedAt?: number;
}

interface AttestationResponse {
  messages: Array<{
    attestation: string;
    message: string;
    eventNonce: string;
    status: string;
  }>;
}

// In-memory store of active bridge transactions
const _activeBridges: Map<string, BridgeTransaction> = new Map();

/**
 * Register a new bridge transaction for tracking
 */
export function trackBridge(tx: Omit<BridgeTransaction, "status" | "createdAt">): BridgeTransaction {
  const bridge: BridgeTransaction = {
    ...tx,
    status: "sent",
    createdAt: Date.now(),
  };
  _activeBridges.set(tx.transactionHash, bridge);
  logger.info("Bridge transaction tracked", {
    txHash: tx.transactionHash,
    nonce: tx.nonce.toString(),
    destinationDomain: tx.destinationDomain,
    amount: tx.amount.toString(),
  });
  return bridge;
}

/**
 * Poll Circle Attestation API for a specific transaction
 */
export async function pollAttestation(transactionHash: string): Promise<BridgeTransaction | null> {
  const bridge = _activeBridges.get(transactionHash);
  if (!bridge) return null;

  // Already complete -- skip polling
  if (bridge.status === "complete") return bridge;

  try {
    const url = `${ATTESTATION_API_BASE}/v2/messages?transactionHash=${transactionHash}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      // 404 means attestation not yet available -- still pending
      if (response.status === 404) {
        bridge.status = "pending_attestation";
        return bridge;
      }
      logger.warn("Attestation API error", {
        txHash: transactionHash,
        status: response.status,
      });
      return bridge;
    }

    const data = (await response.json()) as AttestationResponse;

    if (data.messages && data.messages.length > 0) {
      const msg = data.messages[0];
      if (msg.attestation && msg.attestation !== "PENDING") {
        bridge.status = "complete";
        bridge.completedAt = Date.now();
        bridge.messageHash = msg.message;
        logger.info("Bridge attestation complete", {
          txHash: transactionHash,
          nonce: bridge.nonce.toString(),
        });
      } else {
        bridge.status = "pending_attestation";
      }
    } else {
      bridge.status = "pending_attestation";
    }

    return bridge;
  } catch (error) {
    logger.error("Attestation polling failed", {
      txHash: transactionHash,
      error: error instanceof Error ? error.message : String(error),
    });
    return bridge;
  }
}

/**
 * Get current status of a tracked bridge transaction
 */
export function getBridgeStatus(transactionHash: string): BridgeTransaction | null {
  return _activeBridges.get(transactionHash) ?? null;
}

/**
 * Get all active (non-complete) bridge transactions
 */
export function getActiveBridges(): BridgeTransaction[] {
  return Array.from(_activeBridges.values()).filter((b) => b.status !== "complete");
}

/**
 * Get all tracked bridge transactions
 */
export function getAllBridges(): BridgeTransaction[] {
  return Array.from(_activeBridges.values());
}

/**
 * Start polling loop for all active bridges
 * Polls every intervalMs for attestation status updates
 */
export function startAttestationPoller(intervalMs = 15_000): NodeJS.Timeout {
  logger.info("Starting CCTP attestation poller", { intervalMs });

  return setInterval(async () => {
    const active = getActiveBridges();
    if (active.length === 0) return;

    logger.info("Polling attestations", { activeBridges: active.length });

    for (const bridge of active) {
      await pollAttestation(bridge.transactionHash);
    }
  }, intervalMs);
}
