<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./chariot-light.svg">
    <source media="(prefers-color-scheme: light)" srcset="./chariot-dark.svg">
    <img alt="Chariot" src="./chariot-dark.svg" width="400">
  </picture>
</p>

<p align="center">
  Crosschain Collateral Lending Protocol on Arc
</p>

---

## What is Chariot

Chariot is a crosschain collateral lending protocol deployed on [Arc Testnet](https://testnet.arcscan.app). Borrowers deposit ETH on Ethereum as collateral, which is bridged to Arc via a custom ETHEscrow bridge, and borrow USDC against it at dynamic rates. Lenders deposit USDC into an ERC-4626 vault and earn yield from two simultaneous sources: borrower interest payments and T-bill returns on idle capital via USYC (tokenized US Treasury bills).

Arc serves as the central clearing hub -- all lending, borrowing, and liquidation happens on Arc with sub-second deterministic finality and ~$0.01 transaction fees.

## Core Features

**Dual-Yield Vault** -- The ChariotVault implements ERC-4626 and splits deposited USDC between a lending pool (earning borrower interest) and a USYC strategy (earning ~4.5% APY from tokenized T-bills). The vault actively rebalances between the two, maintaining a 5% liquid USDC buffer. At low utilisation, lenders still earn near-T-bill rates instead of the near-zero yields typical of Aave-style protocols.

**Dynamic Interest Rates** -- Borrow rates follow an Aave V3-style kinked utilisation curve. Below 80% utilisation, rates rise gently (4% slope). Above 80%, rates spike aggressively (75% slope) to incentivize repayment. A volatility premium is added on top -- `kVol * max(0, currentVol - baselineVol)` -- which charges higher rates when collateral volatility exceeds the baseline, gracefully degrading to zero when volatility feeds are not configured.

**Volatility-Adjusted Risk Parameters** -- LTV ratios and liquidation thresholds adjust based on oracle volatility data. When ETH volatility spikes, LTV tightens automatically (`effectiveLTV = baseLTV - K_LTV * excessVol`). The liquidation threshold follows at a fixed 7% buffer above effective LTV. Falls back to static base LTV (75%) when volatility feeds are unavailable.

**Crosschain ETH Bridge** -- ETH is locked in the ETHEscrow contract on Ethereum Sepolia. A Node.js relayer watches for deposit events and mints BridgedETH (ERC-20) on Arc. On withdrawal, BridgedETH is burned on Arc and the relayer releases ETH on Sepolia. Nonce-based replay protection prevents double-minting, with 24-hour timeout refunds as a safety net.

**Liquidation Engine** -- Positions with a health factor below 1.0 can be liquidated. Liquidators repay up to 50% of a borrower's debt and seize collateral with a bonus that scales from 5% to 10% based on how far underwater the position is.

**Circuit Breakers** -- Three-level protection system. Level 1 pauses new borrows on >15% collateral drops. Level 2 rate-limits withdrawals on >20% pool outflows. Level 3 triggers emergency mode on sustained >95% utilisation or stale oracles, requiring admin intervention to resume. Escalation and de-escalation logic is automatic, but external callers must feed metrics to the contract via `recordCollateralValue()`, `recordWithdrawal()`, `recordUtilisation()`, and `recordOracleTimestamp()`.

**CCTP Bridge** -- Borrowed USDC can be bridged from Arc to Ethereum, Arbitrum, or Base using Circle's Cross-Chain Transfer Protocol via the CCTPBridge contract wrapping TokenMessengerV2.

**Vault Management Agent** -- An autonomous Node.js agent manages the USYC rebalancing strategy using a Circle developer-controlled wallet (EOA, gas-sponsored via Circle Gas Station). Runs a 60-second monitoring loop, evaluates rebalance opportunities with a utility-based decision engine, and executes `ChariotVault.rebalance()`. Rate-limited to 3 rebalances per day. On circuit breaker Level 3, it triggers emergency full USYC redemption.

## Smart Contract Architecture

13 Solidity contracts (^0.8.30, Prague EVM) built with Foundry, using OpenZeppelin for access control and reentrancy guards, and Solady FixedPointMathLib for WAD (18-decimal) precision math.

### Core

| Contract | Responsibility |
|----------|---------------|
| **ChariotVault** | ERC-4626 vault. Accepts USDC deposits, issues chUSDC shares, manages dual-yield strategy (lending pool + USYC). Rebalances idle USDC to/from USYC Teller. |
| **LendingPool** | Holds lendable USDC. Processes `borrow()` / `repay()`. Accrues interest via a global index pattern (O(1) per user, no loops). Supports `borrowAndBridge()` for cross-chain borrows via CCTP. |
| **CollateralManager** | Holds borrower BridgedETH collateral. Tracks per-user balances. Calculates collateral value and health factors using oracle prices and dynamic risk parameters from RiskParameterEngine. |
| **LiquidationEngine** | Verifies health factor < 1.0, calculates depth-scaled bonus (5-10%), seizes collateral, reduces debt. Max 50% of debt per liquidation. |

### Risk

| Contract | Responsibility |
|----------|---------------|
| **InterestRateModel** | Kinked utilisation curve (base 0%, slope1 4%, slope2 75%, kink 80%). Adds volatility premium from RiskParameterEngine when configured. |
| **RiskParameterEngine** | Reads volatility from Stork oracle feeds. Computes effective LTV and liquidation threshold per collateral type. Falls back to static base LTV when feeds are not set. |
| **CircuitBreaker** | 3-level protection with automatic escalation/de-escalation logic. Enforces borrow pauses, withdrawal rate limits, and emergency shutdowns. Requires external callers to feed metric data. |

### Bridge

| Contract | Responsibility |
|----------|---------------|
| **ETHEscrow** | Deployed on Ethereum Sepolia. Locks native ETH with nonce tracking and 24-hour timeout refunds. |
| **BridgedETH** | ERC-20 on Arc. Minted by relayer on ETH deposit, burned on withdrawal. |
| **CCTPBridge** | Wraps Circle CCTP TokenMessengerV2. Routes USDC to Ethereum (domain 0), Arbitrum (3), Base (6). |

### Oracle & Base

| Contract | Responsibility |
|----------|---------------|
| **SimpleOracle** | Admin-controlled oracle implementing the IStork interface. Prices set via `setPriceNow(feedId, price)`. Used because Stork API is not available on Arc Testnet. |
| **ChariotBase** | Abstract base for all protocol contracts. Provides oracle validation, circuit breaker modifiers, role-based access control (ADMIN, OPERATOR, LENDING_POOL, LIQUIDATION_ENGINE). |
| **ChariotMath** | WAD math helpers wrapping Solady FixedPointMathLib for 18-decimal and USDC 6-decimal conversions. |

## Deployed Contracts

### Chariot Protocol -- Arc Testnet (Chain ID: 5042002)

| Contract | Address |
|----------|---------|
| **ChariotVault** | [`0x21dBa2FDC65E4910a2C34147929294f88c2D8E43`](https://testnet.arcscan.app/address/0x21dBa2FDC65E4910a2C34147929294f88c2D8E43) |
| **LendingPool** | [`0xD00FbD24E77C902F5224981d6c5cA3e1F9EfB318`](https://testnet.arcscan.app/address/0xD00FbD24E77C902F5224981d6c5cA3e1F9EfB318) |
| **CollateralManager** | [`0xeb5343dDDb1Ab728636931c5Ade7B82Af6aca4A6`](https://testnet.arcscan.app/address/0xeb5343dDDb1Ab728636931c5Ade7B82Af6aca4A6) |
| **LiquidationEngine** | [`0xDd8C98E2D0dC38385094CC85cfCf94e422ff9472`](https://testnet.arcscan.app/address/0xDd8C98E2D0dC38385094CC85cfCf94e422ff9472) |
| **InterestRateModel** | [`0x2AFF3e043f8677752aA8FDF2be6cFD1F6408De1c`](https://testnet.arcscan.app/address/0x2AFF3e043f8677752aA8FDF2be6cFD1F6408De1c) |
| **RiskParameterEngine** | [`0x28F88F70fBc07c45C143d1Bc3dBAc426C14Ce4eA`](https://testnet.arcscan.app/address/0x28F88F70fBc07c45C143d1Bc3dBAc426C14Ce4eA) |
| **SimpleOracle** | [`0xef2eD9f23E7dc480c7be7C59Fa5D50C7C901e178`](https://testnet.arcscan.app/address/0xef2eD9f23E7dc480c7be7C59Fa5D50C7C901e178) |
| **BridgedETH** | [`0x42cAA0a88A42b92e1307E625e5253BE0dFABcCc2`](https://testnet.arcscan.app/address/0x42cAA0a88A42b92e1307E625e5253BE0dFABcCc2) |

### Chariot Protocol -- Ethereum Sepolia (Chain ID: 11155111)

| Contract | Address |
|----------|---------|
| **ETHEscrow** | [`0x42cAA0a88A42b92e1307E625e5253BE0dFABcCc2`](https://sepolia.etherscan.io/address/0x42cAA0a88A42b92e1307E625e5253BE0dFABcCc2) |

## License

MIT
