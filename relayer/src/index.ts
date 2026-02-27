import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { StateStore } from "./state.js";
import { ETHEscrowABI, BridgedETHABI } from "./abis.js";

// -- Chain Definitions --

const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: [config.arcRpcUrl] },
  },
} as const satisfies Chain;

// -- Client Setup --

function createClients() {
  if (!config.relayerPrivateKey) {
    throw new Error("RELAYER_PRIVATE_KEY is required");
  }

  const account = privateKeyToAccount(config.relayerPrivateKey as `0x${string}`);

  const ethPublic = createPublicClient({
    chain: sepolia,
    transport: http(config.ethSepoliaRpcUrl),
  });

  const ethWallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(config.ethSepoliaRpcUrl),
  });

  const arcPublic = createPublicClient({
    chain: arcTestnet,
    transport: http(config.arcRpcUrl),
  });

  const arcWallet = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(config.arcRpcUrl),
  });

  return { ethPublic, ethWallet, arcPublic, arcWallet, account };
}

type Clients = ReturnType<typeof createClients>;

// -- Retry Logic --

async function withRetry<T>(
  operation: () => Promise<T>,
  label: string,
): Promise<T> {
  let delay: number = config.retryBaseDelay;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      const isLast = attempt === config.maxRetries;
      logger.error(`${label}.retry`, { attempt, maxRetries: config.maxRetries, delay }, String(err));
      if (isLast) throw err;
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * config.retryMultiplier, config.retryMaxDelay);
    }
  }

  throw new Error(`${label}: exhausted retries`);
}

// -- Event Handlers --

interface DepositedArgs {
  args: { depositor: `0x${string}`; amount: bigint; nonce: bigint };
  transactionHash: `0x${string}`;
}

interface BurnedArgs {
  args: { user: `0x${string}`; amount: bigint };
  transactionHash: `0x${string}`;
}

async function handleDeposited(
  event: DepositedArgs,
  clients: Clients,
  state: StateStore,
): Promise<void> {
  const { depositor, amount, nonce } = event.args;
  const nonceNum = Number(nonce);

  if (state.isNonceProcessed(nonceNum)) {
    logger.info("deposit.skipped_duplicate", { nonce: nonceNum, depositor });
    return;
  }

  // Check on-chain if already processed
  const alreadyProcessed = await clients.arcPublic.readContract({
    address: config.bridgedEthAddress as `0x${string}`,
    abi: BridgedETHABI,
    functionName: "isNonceProcessed",
    args: [nonce],
  });

  if (alreadyProcessed) {
    state.markNonceProcessed(nonceNum);
    logger.info("deposit.already_minted_onchain", { nonce: nonceNum });
    return;
  }

  logger.info("deposit.detected", {
    depositor,
    amount: amount.toString(),
    nonce: nonceNum,
    txHash: event.transactionHash,
  });

  // Mint BridgedETH on Arc
  await withRetry(async () => {
    const hash = await clients.arcWallet.writeContract({
      address: config.bridgedEthAddress as `0x${string}`,
      abi: BridgedETHABI,
      functionName: "mint",
      args: [depositor, amount, nonce],
      chain: arcTestnet,
    });

    logger.info("mint.submitted", { txHash: hash, nonce: nonceNum, depositor });

    const receipt = await clients.arcPublic.waitForTransactionReceipt({ hash });
    logger.info("mint.confirmed", {
      txHash: hash,
      nonce: nonceNum,
      blockNumber: receipt.blockNumber.toString(),
    });
  }, "mint");

  state.markNonceProcessed(nonceNum);
  state.trackDeposit(nonceNum, depositor, amount.toString());
  state.save();
}

async function handleBurned(
  event: BurnedArgs,
  clients: Clients,
  state: StateStore,
): Promise<void> {
  const { user, amount } = event.args;

  logger.info("burn.detected", {
    user,
    amount: amount.toString(),
    txHash: event.transactionHash,
  });

  // Look up the deposit nonce for this user
  const deposit = state.getDepositByUser(user);
  if (!deposit) {
    logger.warn("burn.no_deposit_found", { user });
    return;
  }

  // Release ETH on Ethereum
  await withRetry(async () => {
    const hash = await clients.ethWallet.writeContract({
      address: config.ethEscrowAddress as `0x${string}`,
      abi: ETHEscrowABI,
      functionName: "release",
      args: [user, BigInt(deposit.amount), BigInt(deposit.nonce)],
      chain: sepolia,
    });

    logger.info("release.submitted", { txHash: hash, nonce: deposit.nonce, user });

    const receipt = await clients.ethPublic.waitForTransactionReceipt({ hash });
    logger.info("release.confirmed", {
      txHash: hash,
      nonce: deposit.nonce,
      blockNumber: receipt.blockNumber.toString(),
    });
  }, "release");

  state.removeDeposit(user);
  state.save();
}

// -- Main Loop --

async function pollEvents(
  clients: Clients,
  state: StateStore,
): Promise<void> {
  // Poll Ethereum Sepolia for Deposited events
  const currentEthBlock = await clients.ethPublic.getBlockNumber();
  const ethFromBlock = state.lastEthBlock > 0n ? state.lastEthBlock + 1n : currentEthBlock;

  if (ethFromBlock <= currentEthBlock) {
    try {
      const depositLogs = await clients.ethPublic.getLogs({
        address: config.ethEscrowAddress as `0x${string}`,
        event: parseAbiItem("event Deposited(address indexed depositor, uint256 amount, uint256 nonce)"),
        fromBlock: ethFromBlock,
        toBlock: currentEthBlock,
      });

      for (const log of depositLogs) {
        await handleDeposited(log as unknown as DepositedArgs, clients, state);
      }

      state.lastEthBlock = currentEthBlock;
    } catch (err) {
      logger.error("poll.eth_failed", { fromBlock: ethFromBlock.toString() }, String(err));
    }
  }

  // Poll Arc Testnet for Burned events
  const currentArcBlock = await clients.arcPublic.getBlockNumber();
  const arcFromBlock = state.lastArcBlock > 0n ? state.lastArcBlock + 1n : currentArcBlock;

  if (arcFromBlock <= currentArcBlock) {
    try {
      const burnLogs = await clients.arcPublic.getLogs({
        address: config.bridgedEthAddress as `0x${string}`,
        event: parseAbiItem("event Burned(address indexed user, uint256 amount)"),
        fromBlock: arcFromBlock,
        toBlock: currentArcBlock,
      });

      for (const log of burnLogs) {
        await handleBurned(log as unknown as BurnedArgs, clients, state);
      }

      state.lastArcBlock = currentArcBlock;
    } catch (err) {
      logger.error("poll.arc_failed", { fromBlock: arcFromBlock.toString() }, String(err));
    }
  }

  state.save();
}

async function main(): Promise<void> {
  logger.info("relayer.starting", {
    ethEscrow: config.ethEscrowAddress,
    bridgedEth: config.bridgedEthAddress,
  });

  const clients = createClients();
  const state = new StateStore(config.stateFilePath);

  logger.info("relayer.ready", {
    lastEthBlock: state.lastEthBlock.toString(),
    lastArcBlock: state.lastArcBlock.toString(),
    processedNonces: state.lastEthBlock > 0n ? "loaded" : "fresh",
  });

  // Heartbeat
  let heartbeatCounter = 0;

  while (true) {
    try {
      await pollEvents(clients, state);
    } catch (err) {
      logger.error("relayer.poll_error", {}, String(err));
    }

    heartbeatCounter++;
    if (heartbeatCounter % 10 === 0) {
      logger.info("relayer.heartbeat", {
        cycles: heartbeatCounter,
        lastEthBlock: state.lastEthBlock.toString(),
        lastArcBlock: state.lastArcBlock.toString(),
      });
    }

    await new Promise((r) => setTimeout(r, config.pollingIntervalMs));
  }
}

main().catch((err) => {
  logger.error("relayer.fatal", {}, String(err));
  process.exit(1);
});
