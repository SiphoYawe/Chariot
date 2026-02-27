import { readFileSync, writeFileSync, existsSync } from "fs";
import { logger } from "./logger.js";

export interface RelayerState {
  lastEthBlock: bigint;
  lastArcBlock: bigint;
  processedNonces: number[];
  activeDeposits: Record<string, { nonce: number; amount: string; depositor: string }>;
}

const DEFAULT_STATE: RelayerState = {
  lastEthBlock: 0n,
  lastArcBlock: 0n,
  processedNonces: [],
  activeDeposits: {},
};

export class StateStore {
  private _state: RelayerState;
  private _filePath: string;
  private _processedSet: Set<number>;

  constructor(filePath: string) {
    this._filePath = filePath;
    this._state = this._load();
    this._processedSet = new Set(this._state.processedNonces);
  }

  private _load(): RelayerState {
    try {
      if (existsSync(this._filePath)) {
        const raw = readFileSync(this._filePath, "utf-8");
        const parsed = JSON.parse(raw);
        logger.info("state.loaded", { file: this._filePath, nonces: parsed.processedNonces?.length ?? 0 });
        return {
          lastEthBlock: BigInt(parsed.lastEthBlock || 0),
          lastArcBlock: BigInt(parsed.lastArcBlock || 0),
          processedNonces: parsed.processedNonces || [],
          activeDeposits: parsed.activeDeposits || {},
        };
      }
    } catch (err) {
      logger.error("state.load_failed", { file: this._filePath }, String(err));
    }
    return { ...DEFAULT_STATE };
  }

  save(): void {
    try {
      const serializable = {
        lastEthBlock: this._state.lastEthBlock.toString(),
        lastArcBlock: this._state.lastArcBlock.toString(),
        processedNonces: this._state.processedNonces,
        activeDeposits: this._state.activeDeposits,
      };
      writeFileSync(this._filePath, JSON.stringify(serializable, null, 2));
    } catch (err) {
      logger.error("state.save_failed", { file: this._filePath }, String(err));
    }
  }

  isNonceProcessed(nonce: number): boolean {
    return this._processedSet.has(nonce);
  }

  markNonceProcessed(nonce: number): void {
    if (!this._processedSet.has(nonce)) {
      this._processedSet.add(nonce);
      this._state.processedNonces.push(nonce);
    }
  }

  trackDeposit(nonce: number, depositor: string, amount: string): void {
    this._state.activeDeposits[depositor.toLowerCase()] = { nonce, amount, depositor };
  }

  getDepositByUser(user: string): { nonce: number; amount: string; depositor: string } | undefined {
    return this._state.activeDeposits[user.toLowerCase()];
  }

  removeDeposit(user: string): void {
    delete this._state.activeDeposits[user.toLowerCase()];
  }

  get lastEthBlock(): bigint {
    return this._state.lastEthBlock;
  }

  set lastEthBlock(block: bigint) {
    this._state.lastEthBlock = block;
  }

  get lastArcBlock(): bigint {
    return this._state.lastArcBlock;
  }

  set lastArcBlock(block: bigint) {
    this._state.lastArcBlock = block;
  }
}
