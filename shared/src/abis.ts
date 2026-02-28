// Contract ABIs -- populated after contract compilation
// Import pattern: import { ChariotVaultABI } from "@chariot/shared"

// Minimal ABIs for frontend hooks -- full ABIs from forge build later

export const ChariotVaultABI = [
  {
    type: "function",
    name: "totalAssets",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalLent",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "rebalance",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getSupplyRate",
    inputs: [
      { name: "borrowRate", type: "uint256" },
      { name: "utilisation", type: "uint256" },
      { name: "usycYield", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "pure",
  },
] as const;

export const LendingPoolABI = [
  {
    type: "function",
    name: "getUserDebt",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserPosition",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "principal", type: "uint256" },
          { name: "interestIndex", type: "uint256" },
          { name: "lastAccrualTimestamp", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTotalBorrowed",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "borrow",
    inputs: [
      { name: "collateralToken", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "priceUpdates", type: "tuple[]", components: [] },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "borrowAndBridge",
    inputs: [
      { name: "collateralToken", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "priceUpdates", type: "tuple[]", components: [] },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "repay",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "repayFull",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const CollateralManagerABI = [
  {
    type: "function",
    name: "getCollateralBalance",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getHealthFactor",
    inputs: [
      { name: "user", type: "address" },
      { name: "priceUpdates", type: "tuple[]", components: [] },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getEffectiveLTV",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "depositCollateral",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawCollateral",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getCollateralValue",
    inputs: [
      { name: "user", type: "address" },
      { name: "priceUpdates", type: "tuple[]", components: [] },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

export const InterestRateModelABI = [
  {
    type: "function",
    name: "getBorrowRate",
    inputs: [{ name: "utilisation", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "getSupplyRate",
    inputs: [{ name: "utilisation", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "getUtilisation",
    inputs: [
      { name: "totalBorrowed", type: "uint256" },
      { name: "totalDeposits", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "getRateBreakdown",
    inputs: [
      { name: "utilisation", type: "uint256" },
      { name: "collateralToken", type: "address" },
    ],
    outputs: [
      { name: "baseRate", type: "uint256" },
      { name: "volatilityPremium", type: "uint256" },
      { name: "totalRate", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getBorrowRateWithVolatility",
    inputs: [
      { name: "utilisation", type: "uint256" },
      { name: "collateralToken", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVolatilityPremium",
    inputs: [{ name: "collateralToken", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const ETHEscrowABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [],
    outputs: [{ name: "nonce", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "getDeposit",
    inputs: [{ name: "nonce", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "depositor", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "timestamp", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "nonce", type: "uint256", indexed: true },
      { name: "depositor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const BridgedETHABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const StorkOracleABI = [
  {
    type: "function",
    name: "getTemporalNumericValueV1",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "timestampNs", type: "uint64" },
          { name: "quantizedValue", type: "int192" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

export const LiquidationEngineABI = [] as const;

export const RiskParameterEngineABI = [
  {
    type: "function",
    name: "getRiskParameters",
    inputs: [{ name: "collateralToken", type: "address" }],
    outputs: [
      { name: "effectiveLTV", type: "uint256" },
      { name: "liquidationThreshold", type: "uint256" },
      { name: "currentVolatility", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEffectiveLTV",
    inputs: [{ name: "collateralToken", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLiquidationThreshold",
    inputs: [{ name: "collateralToken", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCurrentVolatility",
    inputs: [{ name: "collateralToken", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getBaseLTV",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const CircuitBreakerABI = [
  {
    type: "function",
    name: "circuitBreakerLevel",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "triggerCircuitBreaker",
    inputs: [{ name: "level", type: "uint8" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resumeCircuitBreaker",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const CCTPBridgeABI = [
  {
    type: "function",
    name: "bridgeUSDC",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
    ],
    outputs: [{ name: "nonce", type: "uint64" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getSupportedChains",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "domain", type: "uint32" },
          { name: "name", type: "string" },
          { name: "estimatedDeliverySeconds", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isChainSupported",
    inputs: [{ name: "domain", type: "uint32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "USDCBridged",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "destinationDomain", type: "uint32", indexed: true },
      { name: "recipient", type: "bytes32", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "nonce", type: "uint64", indexed: false },
    ],
  },
] as const;

export const ERC20ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;
