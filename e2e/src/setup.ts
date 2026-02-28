import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from chariot root and relayer .env for RELAYER_PRIVATE_KEY
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../relayer/.env") });

import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  encodeFunctionData,
  type Address,
  type Abi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Re-export addresses and ABIs from shared
export {
  ADDRESSES,
  CHARIOT_ADDRESSES,
} from "@chariot/shared";
export {
  ChariotVaultABI,
  LendingPoolABI,
  CollateralManagerABI,
  InterestRateModelABI,
  BridgedETHABI,
  SimpleOracleABI,
  LiquidationEngineABI,
  RiskParameterEngineABI,
  CircuitBreakerABI,
  ERC20ABI,
} from "@chariot/shared";
export {
  FEED_IDS,
  USDC_ERC20_DECIMALS,
  ARC_CHAIN_ID,
  RATE_MODEL,
  RISK_PARAMS,
} from "@chariot/shared";

// -- Extended ABIs for functions not in shared --

// BridgedETH.mint (MINTER_ROLE only)
export const BridgedETHMintABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "nonce", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// LendingPool.accrueInterest (public)
export const LendingPoolAccrueABI = [
  {
    type: "function",
    name: "accrueInterest",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// LiquidationEngine.liquidate
export const LiquidationEngineLiquidateABI = [
  {
    type: "function",
    name: "liquidate",
    inputs: [
      { name: "borrower", type: "address" },
      { name: "collateralToken", type: "address" },
      { name: "debtToRepay", type: "uint256" },
      {
        name: "priceUpdates",
        type: "tuple[]",
        components: [
          {
            name: "temporalNumericValue",
            type: "tuple",
            components: [
              { name: "timestampNs", type: "uint64" },
              { name: "quantizedValue", type: "int192" },
            ],
          },
          { name: "id", type: "bytes32" },
          { name: "publisherMerkleRoot", type: "bytes32" },
          { name: "valueComputeAlgHash", type: "bytes32" },
          { name: "r", type: "bytes32" },
          { name: "s", type: "bytes32" },
          { name: "v", type: "uint8" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// -- Arc Testnet chain definition --
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"],
    },
  },
});

// -- Environment validation --
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const ARC_RPC_URL = process.env.ARC_RPC_URL;

if (!DEPLOYER_PRIVATE_KEY) {
  throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");
}
if (!RELAYER_PRIVATE_KEY) {
  throw new Error("RELAYER_PRIVATE_KEY not set in .env");
}
if (!ARC_RPC_URL) {
  throw new Error("ARC_RPC_URL not set in .env");
}

// -- Accounts --
export const deployerAccount = privateKeyToAccount(
  DEPLOYER_PRIVATE_KEY as `0x${string}`
);
export const relayerAccount = privateKeyToAccount(
  RELAYER_PRIVATE_KEY as `0x${string}`
);

// -- Clients --
// Do NOT annotate with explicit WalletClient type -- it erases the account
// type and causes viem to use wallet_sendTransaction instead of signing locally.
const transport = http(ARC_RPC_URL);

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport,
});

export const deployerWallet = createWalletClient({
  account: deployerAccount,
  chain: arcTestnet,
  transport,
});

export const relayerWallet = createWalletClient({
  account: relayerAccount,
  chain: arcTestnet,
  transport,
});

// -- Convenience re-exports --
export const deployerAddress: Address = deployerAccount.address;
export const relayerAddress: Address = relayerAccount.address;

// Oracle feed ID constant
export const ETHUSD_FEED_ID =
  "0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160" as `0x${string}`;

// -- Transaction helpers --

/**
 * Send a transaction from deployer, wait for receipt, return tx hash.
 */
export async function sendDeployerTx(params: {
  to: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}): Promise<`0x${string}`> {
  const data = encodeFunctionData({
    abi: params.abi as Abi,
    functionName: params.functionName,
    args: params.args ?? [],
  });
  const hash = await deployerWallet.sendTransaction({
    to: params.to,
    data,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Send a transaction from relayer, wait for receipt, return tx hash.
 */
export async function sendRelayerTx(params: {
  to: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}): Promise<`0x${string}`> {
  const data = encodeFunctionData({
    abi: params.abi as Abi,
    functionName: params.functionName,
    args: params.args ?? [],
  });
  const hash = await relayerWallet.sendTransaction({
    to: params.to,
    data,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Simulate a contract call (eth_call) from deployer. Useful to check
 * for reverts before sending a real tx, or to get return values from
 * nonpayable functions.
 */
export async function simulateDeployerCall<T = unknown>(params: {
  to: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}): Promise<T> {
  const { result } = await publicClient.simulateContract({
    account: deployerAccount,
    address: params.to,
    abi: params.abi as Abi,
    functionName: params.functionName,
    args: params.args ?? [],
  });
  return result as T;
}
