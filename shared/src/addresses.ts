// Arc Testnet contract addresses
// Source of truth -- all packages import from here

export const ADDRESSES = {
  USDC: "0x3600000000000000000000000000000000000000",
  USYC: "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C",
  USYC_TELLER: "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A",
  USYC_ENTITLEMENTS: "0xcc205224862c7641930c87679e98999d23c26113",
  STORK_ORACLE: "0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62",
  CCTP_TOKEN_MESSENGER_V2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
  PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
} as const;

// Chariot protocol addresses (populated after deployment)
export const CHARIOT_ADDRESSES = {
  CHARIOT_VAULT: "" as `0x${string}`,
  LENDING_POOL: "" as `0x${string}`,
  COLLATERAL_MANAGER: "" as `0x${string}`,
  INTEREST_RATE_MODEL: "" as `0x${string}`,
  LIQUIDATION_ENGINE: "" as `0x${string}`,
  RISK_PARAMETER_ENGINE: "" as `0x${string}`,
  CIRCUIT_BREAKER: "" as `0x${string}`,
  ETH_ESCROW: "" as `0x${string}`,
  BRIDGED_ETH: "" as `0x${string}`,
} as const;

export type AddressKey = keyof typeof ADDRESSES;
export type ChariotAddressKey = keyof typeof CHARIOT_ADDRESSES;
