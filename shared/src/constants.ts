// CRITICAL: Arc Testnet USDC Dual-Decimal Gotcha
// ==================================================
// Native USDC (gas): 18 decimals (native balance via msg.value)
// ERC-20 USDC interface: 6 decimals (contract interactions)
//
// RULES:
// 1. All contracts MUST exclusively use the ERC-20 interface (6 decimals)
// 2. NEVER mix msg.value (18 decimals) with ERC-20 amounts (6 decimals)
// 3. ERC-20 transfers automatically affect native balance
// 4. Amounts less than 1e-6 USDC cannot be transferred via ERC-20
// ==================================================

export const USDC_ERC20_DECIMALS = 6;
export const USDC_NATIVE_DECIMALS = 18;

// Chain configuration
export const ARC_CHAIN_ID = 5042002;
export const ETH_SEPOLIA_CHAIN_ID = 11155111;

// Polling intervals
export const POLLING_INTERVAL_MS = 12_000; // ~1 Arc block

// Oracle configuration
export const STALENESS_THRESHOLD_SECONDS = 3600;

// Stork Oracle Feed IDs
export const FEED_IDS = {
  ETHUSD: "0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160",
  ETHUSD_VGK: "", // Phase 2
  BTCUSD: "", // Phase 3
  SOLUSD: "", // Phase 3
} as const;

// Interest rate model parameters
export const RATE_MODEL = {
  R_BASE: 0, // 0%
  R_SLOPE1: 0.04, // 4%
  R_SLOPE2: 0.75, // 75%
  U_OPTIMAL: 0.80, // 80% kink point
  RESERVE_FACTOR: 0.10, // 10%
  STRATEGY_FEE: 0.05, // 5%
  USYC_YIELD: 0.045, // 4.5%
} as const;

// Risk parameters
export const RISK_PARAMS = {
  BRIDGED_ETH: {
    BASE_LTV: 0.75, // 75%
    LIQUIDATION_THRESHOLD: 0.82, // 82%
    LIQUIDATION_BONUS_BASE: 0.05, // 5% base
    LIQUIDATION_BONUS_MAX_DEPTH: 0.05, // 5% max depth bonus
    LIQUIDATION_BONUS_DEPTH_FACTOR: 50, // depth scaling multiplier
  },
} as const;

// Volatility risk parameters (Phase 2)
export const VOLATILITY_PARAMS = {
  BASELINE_VOLATILITY: 0.25, // 25% annualized
  K_LTV: 0.5, // LTV sensitivity to volatility
  K_VOL_ETH: 0.5, // Borrow rate sensitivity (WAD: 50e16)
  MIN_LTV_FLOOR: 0.30, // 30% absolute minimum LTV
  LIQUIDATION_BUFFER: 0.07, // 7% above effective LTV
} as const;

// CCTP domain IDs for cross-chain USDC bridging
export const CCTP_DOMAINS = {
  ETHEREUM: 0,
  ARBITRUM: 3,
  BASE: 6,
  ARC_TESTNET: 26,
} as const;

// CCTP chain metadata for frontend display
export const CCTP_CHAIN_INFO = {
  [CCTP_DOMAINS.ETHEREUM]: {
    name: "Ethereum",
    estimatedDeliverySeconds: 1140,
    explorerUrl: "https://sepolia.etherscan.io",
  },
  [CCTP_DOMAINS.ARBITRUM]: {
    name: "Arbitrum",
    estimatedDeliverySeconds: 1140,
    explorerUrl: "https://sepolia.arbiscan.io",
  },
  [CCTP_DOMAINS.BASE]: {
    name: "Base",
    estimatedDeliverySeconds: 1140,
    explorerUrl: "https://sepolia.basescan.org",
  },
} as const;

// Circle Attestation API (sandbox)
export const CIRCLE_ATTESTATION_API = "https://iris-api-sandbox.circle.com";

// Agent configuration
export const AGENT_CONFIG = {
  MONITORING_INTERVAL_MS: 60_000, // 60 seconds
  MAX_REBALANCES_PER_DAY: 3,
} as const;
