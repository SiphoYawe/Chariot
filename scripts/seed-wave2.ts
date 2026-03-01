/**
 * Seed Wave 2 -- Additional varied transactions for rich demo data
 *
 * Usage: cd chariot && pnpm exec tsx scripts/seed-wave2.ts
 *
 * Builds on wave 1 seeding. Creates diverse transaction patterns:
 *   - Multiple small deposits at varied amounts
 *   - Collateral deposit/withdrawal cycles
 *   - Borrow-repay-reborrow patterns
 *   - Vault withdraw + re-deposit
 *   - Partial repayments
 *
 * All protocol operations are signed by the USER wallet so events
 * are attributed to the connected MetaMask address.
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
// Environment
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

const USDC: Address = "0x3600000000000000000000000000000000000000";
const SIMPLE_ORACLE: Address = "0xef2eD9f23E7dc480c7be7C59Fa5D50C7C901e178";
const CHARIOT_VAULT: Address = "0x21dBa2FDC65E4910a2C34147929294f88c2D8E43";
const LENDING_POOL: Address = "0xD00FbD24E77C902F5224981d6c5cA3e1F9EfB318";
const COLLATERAL_MANAGER: Address =
  "0xeb5343dDDb1Ab728636931c5Ade7B82Af6aca4A6";
const BRIDGED_ETH: Address = "0x42cAA0a88A42b92e1307E625e5253BE0dFABcCc2";

const ETHUSD_FEED_ID =
  "0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160" as `0x${string}`;

const usdc = (amount: number) => BigInt(Math.round(amount * 1e6));
const ethWei = (amount: number) => BigInt(Math.round(amount * 1e18));
const ETH_PRICE_WAD = 2500n * 10n ** 18n;

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
// ABIs
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

/** Execute a transaction signed by the DEPLOYER (admin ops). */
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

async function refreshOracle() {
  await execTx("Refresh ETHUSD oracle ($2,500)", {
    address: SIMPLE_ORACLE,
    abi: ORACLE_ABI,
    functionName: "setPriceNow",
    args: [ETHUSD_FEED_ID, ETH_PRICE_WAD],
  });
}

// ---------------------------------------------------------------------------
// Phase A: More Vault Deposits (varied small amounts)
// ---------------------------------------------------------------------------

async function phaseA() {
  banner("Phase A: Varied Vault Deposits");

  await execUserTx("Approve ChariotVault for $10 USDC", {
    address: USDC,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [CHARIOT_VAULT, usdc(10)],
  });

  await execUserTx("Deposit $4.00 USDC into vault", {
    address: CHARIOT_VAULT,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [usdc(4), user],
  });

  await execUserTx("Deposit $2.50 USDC into vault", {
    address: CHARIOT_VAULT,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [usdc(2.5), user],
  });

  await execUserTx("Deposit $1.75 USDC into vault", {
    address: CHARIOT_VAULT,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [usdc(1.75), user],
  });
}

// ---------------------------------------------------------------------------
// Phase B: Partial Repay
// ---------------------------------------------------------------------------

async function phaseB() {
  banner("Phase B: Partial Debt Repayment");

  await execUserTx("Approve LendingPool for $2 USDC repay", {
    address: USDC,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [LENDING_POOL, usdc(2)],
  });

  await execUserTx("Repay $2.00 USDC of debt", {
    address: LENDING_POOL,
    abi: POOL_ABI,
    functionName: "repay",
    args: [usdc(2)],
  });
}

// ---------------------------------------------------------------------------
// Phase C: Mint More BridgedETH + Collateral Deposits
// ---------------------------------------------------------------------------

async function phaseC() {
  banner("Phase C: Mint BridgedETH + Collateral Operations");

  // Deployer mints BridgedETH to user (two separate bridge events)
  await execTx("Mint 1.5 BridgedETH to user (nonce=1001)", {
    address: BRIDGED_ETH,
    abi: BRIDGED_ETH_ABI,
    functionName: "mint",
    args: [user, ethWei(1.5), 1001n],
  });

  await execTx("Mint 0.8 BridgedETH to user (nonce=1002)", {
    address: BRIDGED_ETH,
    abi: BRIDGED_ETH_ABI,
    functionName: "mint",
    args: [user, ethWei(0.8), 1002n],
  });

  // User approves collateral manager
  await execUserTx("Approve CollateralManager for 2.3 BridgedETH", {
    address: BRIDGED_ETH,
    abi: BRIDGED_ETH_ABI,
    functionName: "approve",
    args: [COLLATERAL_MANAGER, ethWei(2.3)],
  });

  // User deposits collateral in two batches
  await execUserTx("Deposit 1.2 BridgedETH as collateral", {
    address: COLLATERAL_MANAGER,
    abi: COLLATERAL_ABI,
    functionName: "depositCollateral",
    args: [BRIDGED_ETH, ethWei(1.2)],
  });

  await execUserTx("Deposit 0.5 BridgedETH as collateral", {
    address: COLLATERAL_MANAGER,
    abi: COLLATERAL_ABI,
    functionName: "depositCollateral",
    args: [BRIDGED_ETH, ethWei(0.5)],
  });
}

// ---------------------------------------------------------------------------
// Phase D: Additional Borrows
// ---------------------------------------------------------------------------

async function phaseD() {
  banner("Phase D: Additional Borrows");

  await refreshOracle();

  await execUserTx("Borrow $4.00 USDC", {
    address: LENDING_POOL,
    abi: POOL_ABI,
    functionName: "borrow",
    args: [BRIDGED_ETH, usdc(4), []],
  });

  await refreshOracle();

  await execUserTx("Borrow $3.00 USDC", {
    address: LENDING_POOL,
    abi: POOL_ABI,
    functionName: "borrow",
    args: [BRIDGED_ETH, usdc(3), []],
  });
}

// ---------------------------------------------------------------------------
// Phase E: Repay-then-Reborrow Cycle
// ---------------------------------------------------------------------------

async function phaseE() {
  banner("Phase E: Repay-Reborrow Cycle");

  await execUserTx("Approve LendingPool for $5 USDC repay", {
    address: USDC,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [LENDING_POOL, usdc(5)],
  });

  await execUserTx("Repay $5.00 USDC", {
    address: LENDING_POOL,
    abi: POOL_ABI,
    functionName: "repay",
    args: [usdc(5)],
  });

  await refreshOracle();

  await execUserTx("Re-borrow $3.00 USDC", {
    address: LENDING_POOL,
    abi: POOL_ABI,
    functionName: "borrow",
    args: [BRIDGED_ETH, usdc(3), []],
  });
}

// ---------------------------------------------------------------------------
// Phase F: Vault Withdraw + Re-deposit Cycle
// ---------------------------------------------------------------------------

async function phaseF() {
  banner("Phase F: Vault Withdraw + Re-deposit");

  await execUserTx("Withdraw $3.00 USDC from vault", {
    address: CHARIOT_VAULT,
    abi: VAULT_ABI,
    functionName: "withdraw",
    args: [usdc(3), user, user],
  });

  await execUserTx("Approve ChariotVault for $5 USDC", {
    address: USDC,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [CHARIOT_VAULT, usdc(5)],
  });

  await execUserTx("Deposit $5.00 USDC into vault", {
    address: CHARIOT_VAULT,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [usdc(5), user],
  });
}

// ---------------------------------------------------------------------------
// Phase G: Collateral Withdrawal (partial)
// ---------------------------------------------------------------------------

async function phaseG() {
  banner("Phase G: Partial Collateral Withdrawal");

  await refreshOracle();

  await execUserTx("Withdraw 0.3 BridgedETH collateral", {
    address: COLLATERAL_MANAGER,
    abi: COLLATERAL_ABI,
    functionName: "withdrawCollateral",
    args: [BRIDGED_ETH, ethWei(0.3)],
  });
}

// ---------------------------------------------------------------------------
// Phase H: Quick Borrow + Immediate Partial Repay
// ---------------------------------------------------------------------------

async function phaseH() {
  banner("Phase H: Quick Borrow + Immediate Repay");

  await refreshOracle();

  await execUserTx("Borrow $2.00 USDC", {
    address: LENDING_POOL,
    abi: POOL_ABI,
    functionName: "borrow",
    args: [BRIDGED_ETH, usdc(2), []],
  });

  await execUserTx("Approve LendingPool for $1.50 USDC", {
    address: USDC,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [LENDING_POOL, usdc(1.5)],
  });

  await execUserTx("Repay $1.50 USDC immediately", {
    address: LENDING_POOL,
    abi: POOL_ABI,
    functionName: "repay",
    args: [usdc(1.5)],
  });
}

// ---------------------------------------------------------------------------
// Phase I: Final Varied Deposits
// ---------------------------------------------------------------------------

async function phaseI() {
  banner("Phase I: Final Varied Deposits");

  await execUserTx("Approve ChariotVault for $4 USDC", {
    address: USDC,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [CHARIOT_VAULT, usdc(4)],
  });

  await execUserTx("Deposit $1.25 USDC into vault", {
    address: CHARIOT_VAULT,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [usdc(1.25), user],
  });

  await execUserTx("Deposit $2.75 USDC into vault", {
    address: CHARIOT_VAULT,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [usdc(2.75), user],
  });
}

// ---------------------------------------------------------------------------
// Phase J: Final Oracle + Verification
// ---------------------------------------------------------------------------

async function phaseJ() {
  banner("Phase J: Final Verification");

  await refreshOracle();

  console.log("\n  Reading final protocol state...\n");

  const [
    totalAssets,
    totalLent,
    totalSupply,
    totalBorrowed,
    userDebt,
    userCollateral,
    ethPrice,
    collateralValue,
    userUSDC,
    userShares,
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
    publicClient.readContract({
      address: USDC,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [user],
    }),
    publicClient.readContract({
      address: CHARIOT_VAULT,
      abi: VAULT_ABI,
      functionName: "balanceOf",
      args: [user],
    }),
  ]);

  const tvl = Number(formatUnits(totalAssets, 6));
  const borrowed = Number(formatUnits(totalBorrowed, 6));
  const util = tvl > 0 ? ((borrowed / tvl) * 100).toFixed(2) : "0.00";
  const collVal = Number(formatUnits(collateralValue, 6));
  const debt = Number(formatUnits(userDebt, 6));
  const hf = debt > 0 ? ((collVal * 0.82) / debt).toFixed(2) : "Inf";

  console.log(
    "  +---------------------------------------------+"
  );
  console.log(
    "  |         FINAL PROTOCOL STATE                |"
  );
  console.log(
    "  +---------------------------------------------+"
  );
  console.log(
    `  |  Vault TVL               $${formatUnits(totalAssets, 6).padStart(14)} |`
  );
  console.log(
    `  |  Vault Lent Out          $${formatUnits(totalLent, 6).padStart(14)} |`
  );
  console.log(
    `  |  Total Borrowed          $${formatUnits(totalBorrowed, 6).padStart(14)} |`
  );
  console.log(
    `  |  Utilisation              ${util.padStart(13)}% |`
  );
  console.log(
    `  |  ETH Price               $${formatUnits(ethPrice, 18).padStart(14)} |`
  );
  console.log(
    "  +---------------------------------------------+"
  );
  console.log(
    `  |  User Debt               $${formatUnits(userDebt, 6).padStart(14)} |`
  );
  console.log(
    `  |  User Collateral          ${formatUnits(userCollateral, 18).padStart(12)} ETH |`
  );
  console.log(
    `  |  Collateral Value        $${formatUnits(collateralValue, 6).padStart(14)} |`
  );
  console.log(
    `  |  Health Factor            ${hf.padStart(14)} |`
  );
  console.log(
    `  |  User USDC              $${formatUnits(userUSDC, 6).padStart(14)} |`
  );
  console.log(
    `  |  User chUSDC             ${formatUnits(userShares, 6).padStart(14)} |`
  );
  console.log(
    "  +---------------------------------------------+"
  );
  console.log(`\n  Wave 2 transactions executed: ${txCount}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n  Chariot Protocol -- Seed Wave 2");
  console.log("  ================================");
  console.log(`  Deployer: ${deployer}`);
  console.log(`  User:     ${user}`);
  console.log(`  RPC:      ${RPC_URL}`);

  try {
    await phaseA(); // 4 tx: approve + 3 deposits
    await phaseB(); // 2 tx: approve + repay
    await phaseC(); // 5 tx: 2 mints (deployer) + approve + 2 collateral deposits (user)
    await phaseD(); // 4 tx: oracle (deployer) + borrow (user) + oracle + borrow
    await phaseE(); // 4 tx: approve + repay (user) + oracle (deployer) + borrow (user)
    await phaseF(); // 3 tx: withdraw + approve + deposit (all user)
    await phaseG(); // 2 tx: oracle (deployer) + collateral withdrawal (user)
    await phaseH(); // 4 tx: oracle (deployer) + borrow + approve + repay (user)
    await phaseI(); // 3 tx: approve + 2 deposits (user)
    await phaseJ(); // 1 tx: oracle (deployer) + read state

    banner("Wave 2 Seeding Complete!");
    console.log(
      "  Dashboard should now show rich, varied transaction history.\n"
    );
  } catch (error: any) {
    console.error(`\n  ABORTED at transaction ${txCount}.`);
    console.error(
      `  Error: ${error.shortMessage || error.message || String(error)}`
    );
    process.exit(1);
  }
}

main();
