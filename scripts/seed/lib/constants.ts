// chariot/scripts/seed/lib/constants.ts
import { defineChain, type Address } from "viem";

// -- Chain --
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.blockdaemon.testnet.arc.network"] },
  },
});

// -- Contract Addresses --
export const USDC: Address = "0x3600000000000000000000000000000000000000";
export const SIMPLE_ORACLE: Address = "0xef2eD9f23E7dc480c7be7C59Fa5D50C7C901e178";
export const CHARIOT_VAULT: Address = "0x21dBa2FDC65E4910a2C34147929294f88c2D8E43";
export const LENDING_POOL: Address = "0xD00FbD24E77C902F5224981d6c5cA3e1F9EfB318";
export const COLLATERAL_MANAGER: Address = "0xeb5343dDDb1Ab728636931c5Ade7B82Af6aca4A6";
export const BRIDGED_ETH: Address = "0x42cAA0a88A42b92e1307E625e5253BE0dFABcCc2";

// -- Oracle --
export const ETHUSD_FEED_ID =
  "0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160" as `0x${string}`;
// $2,500 in 18-decimal WAD -- adjust if ETH price has moved significantly
export const ETH_PRICE_WAD = 2500n * 10n ** 18n;

// -- Helpers --
export const usdc = (n: number) => BigInt(Math.round(n * 1_000_000));
export const eth = (n: number) => BigInt(Math.round(n * 1e9)) * 10n ** 9n;

// -- ABIs --
export const ERC20_ABI = [
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;

export const BRIDGED_ETH_ABI = [
  { type: "function", name: "mint", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }, { name: "nonce", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;

export const ORACLE_ABI = [
  { type: "function", name: "setPriceNow", inputs: [{ name: "id", type: "bytes32" }, { name: "value", type: "int192" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "getTemporalNumericValueV1", inputs: [{ name: "id", type: "bytes32" }], outputs: [{ name: "", type: "tuple", components: [{ name: "timestampNs", type: "uint64" }, { name: "quantizedValue", type: "int192" }] }], stateMutability: "view" },
] as const;

export const VAULT_ABI = [
  { type: "function", name: "deposit", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [{ name: "shares", type: "uint256" }], stateMutability: "nonpayable" },
  { type: "function", name: "withdraw", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }, { name: "owner", type: "address" }], outputs: [{ name: "shares", type: "uint256" }], stateMutability: "nonpayable" },
  { type: "function", name: "totalAssets", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "totalLent", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "totalSupply", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "convertToAssets", inputs: [{ name: "shares", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;

export const COLLATERAL_ABI = [
  { type: "function", name: "depositCollateral", inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "withdrawCollateral", inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "getCollateralBalance", inputs: [{ name: "user", type: "address" }, { name: "token", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getCollateralValueView", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getETHPrice", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;

export const POOL_ABI = [
  { type: "function", name: "borrow", inputs: [{ name: "collateralToken", type: "address" }, { name: "amount", type: "uint256" }, { name: "priceUpdates", type: "tuple[]", components: [] }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "repay", inputs: [{ name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "getTotalBorrowed", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getUserDebt", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;
