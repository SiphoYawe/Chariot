/**
 * Seed Transactions -- Populates the Chariot protocol with real on-chain data
 *
 * Usage: cd chariot && npx tsx scripts/seed-transactions.ts
 *
 * Creates deposits, borrows, repays, and collateral operations so the
 * dashboard shows realistic protocol metrics for demo purposes.
 *
 * Wallets:
 *   - Deployer (from contracts/.env DEPLOYER_PRIVATE_KEY) -- admin ops, oracle, minting
 *   - User (from contracts/.env USER_PRIVATE_KEY) -- all protocol operations
 *     (vault deposits, collateral, borrows, repays)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  formatUnits,
  keccak256,
  toHex,
  type Address,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ---------------------------------------------------------------------------
// Environment -- parse contracts/.env manually (no dotenv dependency)
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../contracts/.env");

function loadEnv(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, "utf-8");
  return Object.fromEntries(
    content
      .split("\n")
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => {
        const idx = line.indexOf("=");
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      })
  );
}

const env = loadEnv(envPath);
const DEPLOYER_KEY = env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
if (!DEPLOYER_KEY) {
  console.error("ERROR: DEPLOYER_PRIVATE_KEY not set in contracts/.env");
  process.exit(1);
}
const USER_KEY = env.USER_PRIVATE_KEY as `0x${string}`;
if (!USER_KEY) {
  console.error("ERROR: USER_PRIVATE_KEY not set in contracts/.env");
  console.error("  Add USER_PRIVATE_KEY=0x... (your MetaMask wallet key)");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RPC_URL = "https://rpc.blockdaemon.testnet.arc.network";

// Contract addresses (source: shared/src/addresses.ts)
const USDC: Address = "0x3600000000000000000000000000000000000000";
const SIMPLE_ORACLE: Address = "0xef2eD9f23E7dc480c7be7C59Fa5D50C7C901e178";
const CHARIOT_VAULT: Address = "0x21dBa2FDC65E4910a2C34147929294f88c2D8E43";
const LENDING_POOL: Address = "0xD00FbD24E77C902F5224981d6c5cA3e1F9EfB318";
const COLLATERAL_MANAGER: Address =
  "0xeb5343dDDb1Ab728636931c5Ade7B82Af6aca4A6";
const BRIDGED_ETH: Address = "0x42cAA0a88A42b92e1307E625e5253BE0dFABcCc2";

// Oracle feed ID (source: shared/src/constants.ts)
const ETHUSD_FEED_ID =
  "0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160" as `0x${string}`;

// USDC amounts -- 6 decimals for ERC-20 interface
const usdc = (amount: number) => BigInt(amount) * 1_000_000n;

// ETH amounts -- 18 decimals
const eth = (amount: number) => BigInt(amount) * 10n ** 18n;

// ETH price: $2,500 in 18-decimal WAD
const ETH_PRICE_WAD = 2500n * 10n ** 18n;

// MINTER_ROLE = keccak256("MINTER_ROLE")
const MINTER_ROLE = keccak256(toHex("MINTER_ROLE"));

// ---------------------------------------------------------------------------
// Chain & Clients
// ---------------------------------------------------------------------------

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const deployerAccount = privateKeyToAccount(DEPLOYER_KEY);
const userAccount = privateKeyToAccount(USER_KEY);
const transport = http(RPC_URL);

const publicClient = createPublicClient({ chain: arcTestnet, transport });
const deployerWallet = createWalletClient({
  account: deployerAccount,
  chain: arcTestnet,
  transport,
});
const userWallet = createWalletClient({
  account: userAccount,
  chain: arcTestnet,
  transport,
});

const deployer = deployerAccount.address;
const user = userAccount.address;

// ---------------------------------------------------------------------------
// ABIs (inline -- keeps script self-contained, no build step needed)
// ---------------------------------------------------------------------------

const ERC20_ABI = [
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
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

const ACCESS_CONTROL_ABI = [
  {
    type: "function",
    name: "grantRole",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "hasRole",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

const BRIDGED_ETH_ABI = [
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
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const ORACLE_ABI = [
  {
    type: "function",
    name: "setPriceNow",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "value", type: "int192" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
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

const VAULT_ABI = [
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
    name: "withdraw",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
  },
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
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "convertToAssets",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const COLLATERAL_ABI = [
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
    name: "getCollateralValueView",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getETHPrice",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const POOL_ABI = [
  {
    type: "function",
    name: "borrow",
    inputs: [
      { name: "collateralToken", type: "address" },
      { name: "amount", type: "uint256" },
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
  {
    type: "function",
    name: "repay",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
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
    name: "getUserDebt",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let txCount = 0;

/** Execute a transaction signed by the DEPLOYER (admin ops, oracle, minting). */
async function execTx(
  label: string,
  params: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }
): Promise<Hash> {
  txCount++;
  const tag = `[${String(txCount).padStart(2, " ")}]`;
  process.stdout.write(`  ${tag} ${label}...`);

  try {
    const { request } = await publicClient.simulateContract({
      account: deployerAccount,
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args ?? [],
    } as any);
    const hash = await deployerWallet.writeContract(request as any);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const status = receipt.status === "success" ? "OK" : "REVERTED";
    console.log(` ${status} (${hash.slice(0, 10)}...)`);
    return hash;
  } catch (error: any) {
    const msg = error.shortMessage || error.message || String(error);
    console.log(` FAILED`);
    console.error(`       ${msg.split("\n")[0]}`);
    throw error;
  }
}

/** Execute a transaction signed by the USER (protocol operations). */
async function execUserTx(
  label: string,
  params: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }
): Promise<Hash> {
  txCount++;
  const tag = `[${String(txCount).padStart(2, " ")}]`;
  process.stdout.write(`  ${tag} [user] ${label}...`);

  try {
    const { request } = await publicClient.simulateContract({
      account: userAccount,
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args ?? [],
    } as any);
    const hash = await userWallet.writeContract(request as any);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const status = receipt.status === "success" ? "OK" : "REVERTED";
    console.log(` ${status} (${hash.slice(0, 10)}...)`);
    return hash;
  } catch (error: any) {
    const msg = error.shortMessage || error.message || String(error);
    console.log(` FAILED`);
    console.error(`       ${msg.split("\n")[0]}`);
    throw error;
  }
}

function banner(text: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${text}`);
  console.log(`${"=".repeat(60)}`);
}

// ---------------------------------------------------------------------------
// Phase 1: Admin Setup
// ---------------------------------------------------------------------------

async function phase1_adminSetup() {
  banner("Phase 1: Admin Setup");

  // Check if deployer already has MINTER_ROLE on BridgedETH
  const hasMinterRole = await publicClient.readContract({
    address: BRIDGED_ETH,
    abi: ACCESS_CONTROL_ABI,
    functionName: "hasRole",
    args: [MINTER_ROLE, deployer],
  });

  if (hasMinterRole) {
    console.log("  -- Deployer already has MINTER_ROLE, skipping grantRole");
  } else {
    await execTx("Grant MINTER_ROLE to deployer on BridgedETH", {
      address: BRIDGED_ETH,
      abi: ACCESS_CONTROL_ABI,
      functionName: "grantRole",
      args: [MINTER_ROLE, deployer],
    });
  }

  // Set ETH price to $2,500
  await execTx("Set ETHUSD oracle price to $2,500", {
    address: SIMPLE_ORACLE,
    abi: ORACLE_ABI,
    functionName: "setPriceNow",
    args: [ETHUSD_FEED_ID, ETH_PRICE_WAD],
  });
}

// ---------------------------------------------------------------------------
// Phase 2: Fund User + Lender Deposits (~$31 into vault, credited to user)
// ---------------------------------------------------------------------------

async function phase2_lenderDeposits() {
  banner("Phase 2: Fund User + Lender Deposits (~$31 into vault)");

  // Check deployer USDC balance
  const balance = await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [deployer],
  });
  console.log(`  Deployer USDC balance: $${formatUnits(balance, 6)}`);

  // Transfer $40 USDC to user (covers vault deposits + repays later)
  await execTx("Transfer $40 USDC to user wallet", {
    address: USDC,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [user, usdc(40)],
  });

  // User approves vault for $35
  await execUserTx("Approve ChariotVault for $35 USDC", {
    address: USDC,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [CHARIOT_VAULT, usdc(35)],
  });

  // User makes three separate deposits
  await execUserTx("Deposit $12 USDC into vault", {
    address: CHARIOT_VAULT,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [usdc(12), user],
  });

  await execUserTx("Deposit $9 USDC into vault", {
    address: CHARIOT_VAULT,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [usdc(9), user],
  });

  await execUserTx("Deposit $7 USDC into vault", {
    address: CHARIOT_VAULT,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [usdc(7), user],
  });

  // One more deposit for variety
  await execUserTx("Deposit $3 USDC into vault", {
    address: CHARIOT_VAULT,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [usdc(3), user],
  });
}

// ---------------------------------------------------------------------------
// Phase 3: Borrower Operations (user borrows against BridgedETH)
// ---------------------------------------------------------------------------

async function phase3_borrowerOps() {
  banner("Phase 3: Borrower Operations (ETH collateral + USDC borrows)");

  // Deployer mints 0.01 BridgedETH to user (nonce=1000 avoids bridge collision)
  // 0.01 ETH * $2,500 = $25 collateral value
  await execTx("Mint 0.01 BridgedETH to user (nonce=1000)", {
    address: BRIDGED_ETH,
    abi: BRIDGED_ETH_ABI,
    functionName: "mint",
    args: [user, 10n ** 16n, 1000n], // 0.01 ETH
  });

  // User approves CollateralManager for 0.01 BridgedETH
  await execUserTx("Approve CollateralManager for 0.01 BridgedETH", {
    address: BRIDGED_ETH,
    abi: BRIDGED_ETH_ABI,
    functionName: "approve",
    args: [COLLATERAL_MANAGER, 10n ** 16n],
  });

  // User deposits 0.007 ETH as collateral ($17.50 value)
  await execUserTx("Deposit 0.007 BridgedETH as collateral", {
    address: COLLATERAL_MANAGER,
    abi: COLLATERAL_ABI,
    functionName: "depositCollateral",
    args: [BRIDGED_ETH, 7n * 10n ** 15n], // 0.007 ETH
  });

  // Refresh oracle before borrow (staleness threshold is 3600s)
  await execTx("Refresh ETHUSD oracle price before borrow", {
    address: SIMPLE_ORACLE,
    abi: ORACLE_ABI,
    functionName: "setPriceNow",
    args: [ETHUSD_FEED_ID, ETH_PRICE_WAD],
  });

  // User borrows $7 USDC against BridgedETH
  await execUserTx("Borrow $7 USDC against BridgedETH", {
    address: LENDING_POOL,
    abi: POOL_ABI,
    functionName: "borrow",
    args: [BRIDGED_ETH, usdc(7), []],
  });

  // User deposits 0.003 more ETH as collateral (total 0.01 ETH = $25)
  await execUserTx("Deposit 0.003 more BridgedETH as collateral", {
    address: COLLATERAL_MANAGER,
    abi: COLLATERAL_ABI,
    functionName: "depositCollateral",
    args: [BRIDGED_ETH, 3n * 10n ** 15n], // 0.003 ETH
  });

  // Refresh oracle again
  await execTx("Refresh ETHUSD oracle price", {
    address: SIMPLE_ORACLE,
    abi: ORACLE_ABI,
    functionName: "setPriceNow",
    args: [ETHUSD_FEED_ID, ETH_PRICE_WAD],
  });

  // User borrows $5 more USDC (total debt ~$12, collateral $25, HF ~1.71)
  await execUserTx("Borrow $5 more USDC", {
    address: LENDING_POOL,
    abi: POOL_ABI,
    functionName: "borrow",
    args: [BRIDGED_ETH, usdc(5), []],
  });
}

// ---------------------------------------------------------------------------
// Phase 4: Repayment & Activity Variety
// ---------------------------------------------------------------------------

async function phase4_repaymentActivity() {
  banner("Phase 4: Repayment & Activity Variety");

  // User approves LendingPool for $3 repay (uses USDC received from borrow)
  await execUserTx("Approve LendingPool for $3 USDC repay", {
    address: USDC,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [LENDING_POOL, usdc(3)],
  });

  // User repays $3
  await execUserTx("Repay $3 USDC of borrowed debt", {
    address: LENDING_POOL,
    abi: POOL_ABI,
    functionName: "repay",
    args: [usdc(3)],
  });

  // User withdraws $2 from vault
  await execUserTx("Withdraw $2 USDC from vault", {
    address: CHARIOT_VAULT,
    abi: VAULT_ABI,
    functionName: "withdraw",
    args: [usdc(2), user, user],
  });

  // User re-deposits $3 into vault
  await execUserTx("Approve ChariotVault for $3 USDC", {
    address: USDC,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [CHARIOT_VAULT, usdc(3)],
  });

  await execUserTx("Re-deposit $3 USDC into vault", {
    address: CHARIOT_VAULT,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [usdc(3), user],
  });
}

// ---------------------------------------------------------------------------
// Phase 5: Final Oracle Refresh & Verification
// ---------------------------------------------------------------------------

async function phase5_verification() {
  banner("Phase 5: Final Oracle Refresh & Verification");

  // Final oracle refresh to keep price fresh for dashboard
  await execTx("Final ETHUSD oracle refresh", {
    address: SIMPLE_ORACLE,
    abi: ORACLE_ABI,
    functionName: "setPriceNow",
    args: [ETHUSD_FEED_ID, ETH_PRICE_WAD],
  });

  // Read all protocol state
  console.log("\n  Reading protocol state...\n");

  const [
    totalAssets,
    totalLent,
    totalSupply,
    totalBorrowed,
    userShares,
    userDebt,
    userCollateral,
    ethPrice,
    collateralValue,
  ] = await Promise.all([
    publicClient.readContract({
      address: CHARIOT_VAULT,
      abi: VAULT_ABI,
      functionName: "totalAssets",
    }),
    publicClient.readContract({
      address: CHARIOT_VAULT,
      abi: VAULT_ABI,
      functionName: "totalLent",
    }),
    publicClient.readContract({
      address: CHARIOT_VAULT,
      abi: VAULT_ABI,
      functionName: "totalSupply",
    }),
    publicClient.readContract({
      address: LENDING_POOL,
      abi: POOL_ABI,
      functionName: "getTotalBorrowed",
    }),
    publicClient.readContract({
      address: CHARIOT_VAULT,
      abi: VAULT_ABI,
      functionName: "balanceOf",
      args: [user],
    }),
    publicClient.readContract({
      address: LENDING_POOL,
      abi: POOL_ABI,
      functionName: "getUserDebt",
      args: [user],
    }),
    publicClient.readContract({
      address: COLLATERAL_MANAGER,
      abi: COLLATERAL_ABI,
      functionName: "getCollateralBalance",
      args: [user, BRIDGED_ETH],
    }),
    publicClient.readContract({
      address: COLLATERAL_MANAGER,
      abi: COLLATERAL_ABI,
      functionName: "getETHPrice",
    }),
    publicClient.readContract({
      address: COLLATERAL_MANAGER,
      abi: COLLATERAL_ABI,
      functionName: "getCollateralValueView",
      args: [user],
    }),
  ]);

  // Compute derived metrics
  const totalAssetsNum = Number(formatUnits(totalAssets, 6));
  const totalBorrowedNum = Number(formatUnits(totalBorrowed, 6));
  const utilisation =
    totalAssetsNum > 0
      ? ((totalBorrowedNum / totalAssetsNum) * 100).toFixed(2)
      : "0.00";
  const sharePrice =
    totalSupply > 0n
      ? formatUnits((totalAssets * 1_000_000n) / totalSupply, 6)
      : "1.000000";

  // Collateral value: getCollateralValueView returns USDC 6 decimals
  const collValueNum = Number(formatUnits(collateralValue, 6));
  const debtNum = Number(formatUnits(userDebt, 6));
  const healthFactor =
    debtNum > 0 ? ((collValueNum * 0.82) / debtNum).toFixed(2) : "Inf";

  console.log(
    "  +-------------------------------------------+"
  );
  console.log(
    "  |       PROTOCOL STATE SUMMARY              |"
  );
  console.log(
    "  +-------------------------------------------+"
  );
  console.log(
    `  |  Total Vault Assets (TVL)  $${formatUnits(totalAssets, 6).padStart(12)} |`
  );
  console.log(
    `  |  Total Lent Out           $${formatUnits(totalLent, 6).padStart(12)} |`
  );
  console.log(
    `  |  Total Borrowed           $${formatUnits(totalBorrowed, 6).padStart(12)} |`
  );
  console.log(
    `  |  Total Vault Shares        ${formatUnits(totalSupply, 6).padStart(12)} |`
  );
  console.log(
    `  |  Pool Utilisation           ${utilisation.padStart(10)}% |`
  );
  console.log(
    `  |  Share Price              $${sharePrice.padStart(12)} |`
  );
  console.log(
    `  |  ETH Oracle Price         $${formatUnits(ethPrice, 18).padStart(12)} |`
  );
  console.log(
    "  +-------------------------------------------+"
  );
  console.log(
    `  |  User chUSDC              ${formatUnits(userShares, 6).padStart(13)} |`
  );
  console.log(
    `  |  User Debt               $${formatUnits(userDebt, 6).padStart(12)} |`
  );
  console.log(
    `  |  User Collateral          ${formatUnits(userCollateral, 18).padStart(10)} ETH |`
  );
  console.log(
    `  |  Collateral Value        $${formatUnits(collateralValue, 6).padStart(12)} |`
  );
  console.log(
    `  |  Health Factor (approx)   ${healthFactor.padStart(13)} |`
  );
  console.log(
    "  +-------------------------------------------+"
  );
  console.log(`\n  Total transactions executed: ${txCount}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n  Chariot Protocol -- Seed Transactions");
  console.log("  =====================================");
  console.log(`  Deployer: ${deployer}`);
  console.log(`  User:     ${user}`);
  console.log(`  RPC:      ${RPC_URL}`);
  console.log(`  Chain:    Arc Testnet (${arcTestnet.id})`);

  try {
    await phase1_adminSetup();
    await phase2_lenderDeposits();
    await phase3_borrowerOps();
    await phase4_repaymentActivity();
    await phase5_verification();

    banner("Seeding Complete!");
    console.log(
      "  Open the Chariot dashboard to verify all metrics are populated."
    );
    console.log(
      "  Before demo: run 'bash scripts/refresh-oracle.sh' to keep oracle fresh.\n"
    );
  } catch (error: any) {
    console.error(`\n  SEEDING ABORTED at transaction ${txCount}.`);
    console.error(
      `  Error: ${error.shortMessage || error.message || String(error)}`
    );
    console.error(
      "  Fix the issue and re-run. Completed transactions are idempotent.\n"
    );
    process.exit(1);
  }
}

main();
