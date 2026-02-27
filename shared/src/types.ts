// Shared TypeScript types for the Chariot protocol

export interface VaultStats {
  totalAssets: bigint;
  totalSupply: bigint;
  sharePrice: bigint;
  totalBorrowed: bigint;
  totalIdle: bigint;
  usycAllocated: bigint;
  utilisationRate: number;
}

export interface BorrowerPosition {
  collateralAmount: bigint;
  debtAmount: bigint;
  healthFactor: number;
  effectiveLtv: number;
}

export interface OraclePrice {
  value: bigint;
  timestamp: bigint;
}

export interface RateInfo {
  borrowRate: number;
  supplyRate: number;
  utilisationRate: number;
}

export type CircuitBreakerLevel = 0 | 1 | 2 | 3;

export interface ProtocolHealth {
  tvl: bigint;
  totalCollateral: bigint;
  totalDebt: bigint;
  protocolReserves: bigint;
  circuitBreakerLevel: CircuitBreakerLevel;
}
