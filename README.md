<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./chariot-light.svg">
    <source media="(prefers-color-scheme: light)" srcset="./chariot-dark.svg">
    <img alt="Chariot" src="./chariot-dark.svg" width="400">
  </picture>
</p>

<p align="center">
  Institutional-Grade Crosschain Collateral Lending Protocol on Arc
</p>

---

## What is Chariot

Chariot is a crosschain collateral lending protocol deployed on [Arc Testnet](https://testnet.arcscan.app). Borrowers deposit ETH on Ethereum as collateral, which is bridged to Arc via a custom ETHEscrow bridge, and borrow USDC against it at dynamic, risk-adjusted rates. Lenders deposit USDC into an ERC-4626 vault and earn yield from two simultaneous sources: borrower interest payments and T-bill returns on idle capital via USYC.

Arc serves as the central clearing hub -- all lending, borrowing, and liquidation happens on Arc with sub-second deterministic finality and ~$0.01 transaction fees.

## Monorepo Structure

Chariot is a pnpm + Turborepo monorepo with five workspaces:

```
chariot/
├── contracts/          Foundry smart contracts (Solidity ^0.8.30)
├── frontend/           Next.js 16 web application
├── relayer/            Node.js cross-chain bridge service
├── agent/              Automated vault rebalancing agent
├── shared/             ABIs, addresses, constants, types (source of truth)
├── package.json        Root config (pnpm 8.15.6 + Turborepo 2.3.0)
└── turbo.json          Turborepo pipeline config
```

## Core Features

### Dual-Yield Vault

The vault implements ERC-4626 and splits deposited USDC between two yield sources:

- **Lending pool** -- USDC available for borrowers. Yield comes from borrower interest.
- **USYC strategy** -- Idle USDC not currently lent out is converted to USYC (tokenized US Treasury bills, ~4.5% APY).

At 20% utilisation, a standard Aave-style protocol yields ~0.18% for lenders. Chariot yields ~3.60% because idle capital earns T-bill rates. The yield floor approximates the T-bill rate regardless of borrow demand.

**Supply rate formula:**

```
Supply Rate = (Borrow_Rate * Utilisation * (1 - Reserve_Factor))
            + (USYC_Yield * (1 - Utilisation) * (1 - Strategy_Fee))
```

### Dynamic Interest Rate Model

Borrow rates use an Aave V3-style kinked utilisation model with three independently calculated components:

```
Total_Borrow_Rate = Utilisation_Rate + Volatility_Premium + Concentration_Premium
```

**Utilisation rate** follows a kinked curve with an optimal utilisation target of 80%. Below the kink, rates increase gently. Above the kink, rates spike aggressively to rebalance supply and demand.

**Default rate parameters:**
- Base rate: 0%
- Slope 1 (below kink): 4%
- Slope 2 (above kink): 75%
- Optimal utilisation: 80%
- Reserve factor: 10%
- Strategy fee: 5%

**Volatility premium** (Phase 2) charges higher rates for borrowing against volatile collateral, using oracle EMA Garman-Klass volatility feeds.

**Concentration premium** (Phase 3) charges higher rates when a single collateral type exceeds 40% of total collateral value.

### Volatility-Adjusted Risk Parameters

LTV ratios and liquidation thresholds adjust dynamically based on real-time oracle volatility feeds:

```
Effective_LTV = Base_LTV - (k_ltv * max(0, Current_Vol - Baseline_Vol))
Liquidation_Threshold = Effective_LTV + Buffer (7%)
```

When ETH volatility spikes, LTV tightens automatically. When it calms, LTV loosens. No governance vote required. This mirrors how CCPs and prime brokers manage margin requirements.

### Crosschain ETH Bridge

Chariot implements a custom ETHEscrow bridge for crosschain collateral:

1. ETH is locked in the ETHEscrow contract on Ethereum Sepolia
2. A Node.js relayer watches for deposit events and mints BridgedETH (ERC-20) on Arc
3. BridgedETH is deposited as collateral in the Chariot CollateralManager
4. On withdrawal, BridgedETH is burned on Arc and the relayer releases ETH on Ethereum

The bridge uses nonce-based replay protection and 24-hour timeout-based refunds.

### Liquidation Engine

Positions with a health factor below 1.0 are liquidatable:

```
Health_Factor = (Collateral_Value * Liquidation_Threshold) / Debt_Value
```

Liquidators repay a portion of the borrower's debt and seize collateral at a bonus. The liquidation bonus scales from 5% to 10% based on how underwater the position is:

```
Liquidation_Bonus = Base_Bonus + min(5%, max(0, (1.0 - HF) * 50))
```

### Interest Accrual (Global Index Pattern)

Interest accrues in O(1) per user using a global index pattern -- no loops over positions:

```
_globalInterestIndex tracks cumulative interest per unit borrowed
Each position stores: (principal, interestIndex_at_borrow, timestamp)
Current_Debt = principal * (_globalInterestIndex / interestIndex_at_borrow)
```

### Circuit Breakers

Three-level protection system modeled after stock exchange circuit breakers:

| Level | Trigger | Action |
|-------|---------|--------|
| **Level 1** | Collateral value drops >15% in 1 hour | Pause new borrows |
| **Level 2** | Withdrawals exceed 20% of pool in 1 hour | Rate-limit withdrawals (5% pool/address/hour) |
| **Level 3** | Utilisation >95% for >30 minutes or oracle failure | Emergency mode -- admin required to resume, full USYC redemption triggered |

### USDC Outflow via CCTP

Borrowed USDC can be bridged from Arc to any CCTP-supported chain (Ethereum, Base, Arbitrum) using Circle's Cross-Chain Transfer Protocol via the CCTPBridge contract.

## Technical Stack

### Smart Contracts

| Component | Technology |
|-----------|-----------|
| Language | Solidity ^0.8.30 (Prague EVM target for Arc) |
| Framework | Foundry (forge, cast, anvil) |
| Standards | ERC-4626 (vault), ERC-20 (collateral tokens, USDC) |
| Math | Solady FixedPointMathLib (WAD 18-decimal precision) |
| Access Control | OpenZeppelin AccessControl (ADMIN, OPERATOR, LENDING_POOL, LIQUIDATION_ENGINE roles) |
| Reentrancy | OpenZeppelin ReentrancyGuard |
| Oracle | SimpleOracle (admin-controlled IStork-compatible interface) |
| Network | Arc Testnet (Chain ID: 5042002) + Ethereum Sepolia (Chain ID: 11155111) |

### Frontend

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16.1.6 (App Router + Turbopack) |
| React | React 19.2.3 |
| Wallet | wagmi 2.x + viem 2.x + RainbowKit 2.2.10 |
| State | TanStack Query 5.x (via wagmi) |
| Styling | Tailwind CSS 4.x + shadcn/ui + Radix UI |
| Charts | Recharts 3.7.0 |
| Icons | Tabler Icons 3.37.1 |
| Notifications | Sonner 2.0.7 |
| Theme | next-themes 0.4.6 |
| Fonts | Red Hat Display + Red Hat Text (self-hosted woff2) |

### Relayer

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js / TypeScript (ESM) |
| Chain Interaction | viem 2.x |
| Logging | Structured JSON logging |
| State | In-memory nonce tracking (replay protection) |

### Agent

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js / TypeScript (ESM) |
| Wallet | Circle Developer-Controlled Wallets SDK 10.x (EOA type) |
| Gas | Circle Gas Station (ERC-4337 sponsored transactions) |
| Decision Engine | Utility-based scoring with rate limiting (max 3 rebalances/day) |
| Monitoring | 60-second polling loop |

## Smart Contract Architecture

Chariot consists of 13 Solidity source files organized into 6 modules:

### Base

| Contract | Responsibility |
|----------|---------------|
| **ChariotBase** | Abstract base for all protocol contracts. Provides oracle integration (`_getValidatedPrice`), circuit breaker modifiers, and cross-cutting admin functions. |
| **ChariotMath** | Library of WAD math helpers wrapping Solady FixedPointMathLib for 18-decimal precision arithmetic. |

### Core

| Contract | Responsibility |
|----------|---------------|
| **ChariotVault** | ERC-4626 vault. Accepts USDC deposits, issues chUSDC shares, manages dual-yield strategy (lending pool + USYC). Exposes `lend()`, `repay()`, and `rebalance()` for pool and agent interactions. |
| **LendingPool** | Holds lendable USDC. Processes `borrow()` / `repay()` transactions. Accrues interest via global index pattern in O(1). |
| **CollateralManager** | Holds borrower BridgedETH collateral. Tracks per-user balances. Calculates collateral value and health factors using oracle prices and dynamic risk parameters. |
| **LiquidationEngine** | Verifies health factor < 1.0, calculates scaled depth bonus, transfers collateral to liquidator, reduces borrower debt. |

### Risk

| Contract | Responsibility |
|----------|---------------|
| **InterestRateModel** | Computes borrow rate from utilisation using an Aave V3-style kinked curve. Configurable base rate, slopes, and kink point. |
| **RiskParameterEngine** | Reads oracle volatility feeds. Computes effective LTV and liquidation threshold per collateral type based on real-time volatility. |
| **CircuitBreaker** | 3-level automated protection system. Monitors protocol metrics and enforces withdrawal rate limits, borrow pauses, and emergency shutdowns. |

### Oracle

| Contract | Responsibility |
|----------|---------------|
| **SimpleOracle** | Admin-controlled oracle implementing the IStork interface. Prices set via `setPriceNow(feedId, price)`. Used in MVP since Stork API is unavailable on Arc Testnet. |

### Bridge

| Contract | Responsibility |
|----------|---------------|
| **ETHEscrow** | Deployed on Ethereum Sepolia. Locks native ETH with nonce-based tracking and 24-hour timeout refunds. Relayer calls `release()` on withdrawal. |
| **BridgedETH** | ERC-20 on Arc. Minted by the relayer when ETH is locked on Sepolia. Burned when withdrawing back to Ethereum. |
| **CCTPBridge** | Bridges USDC between Arc and other chains using Circle CCTP TokenMessengerV2. |

## Deployed Smart Contracts

### Chariot Protocol -- Arc Testnet (Chain ID: 5042002)

| Contract | Address | Module |
|----------|---------|--------|
| **ChariotVault** | [`0x21dBa2FDC65E4910a2C34147929294f88c2D8E43`](https://testnet.arcscan.app/address/0x21dBa2FDC65E4910a2C34147929294f88c2D8E43) | Core |
| **LendingPool** | [`0xD00FbD24E77C902F5224981d6c5cA3e1F9EfB318`](https://testnet.arcscan.app/address/0xD00FbD24E77C902F5224981d6c5cA3e1F9EfB318) | Core |
| **CollateralManager** | [`0xeb5343dDDb1Ab728636931c5Ade7B82Af6aca4A6`](https://testnet.arcscan.app/address/0xeb5343dDDb1Ab728636931c5Ade7B82Af6aca4A6) | Core |
| **LiquidationEngine** | [`0xDd8C98E2D0dC38385094CC85cfCf94e422ff9472`](https://testnet.arcscan.app/address/0xDd8C98E2D0dC38385094CC85cfCf94e422ff9472) | Core |
| **InterestRateModel** | [`0x2AFF3e043f8677752aA8FDF2be6cFD1F6408De1c`](https://testnet.arcscan.app/address/0x2AFF3e043f8677752aA8FDF2be6cFD1F6408De1c) | Risk |
| **RiskParameterEngine** | [`0x28F88F70fBc07c45C143d1Bc3dBAc426C14Ce4eA`](https://testnet.arcscan.app/address/0x28F88F70fBc07c45C143d1Bc3dBAc426C14Ce4eA) | Risk |
| **SimpleOracle** | [`0xef2eD9f23E7dc480c7be7C59Fa5D50C7C901e178`](https://testnet.arcscan.app/address/0xef2eD9f23E7dc480c7be7C59Fa5D50C7C901e178) | Oracle |
| **BridgedETH** | [`0x42cAA0a88A42b92e1307E625e5253BE0dFABcCc2`](https://testnet.arcscan.app/address/0x42cAA0a88A42b92e1307E625e5253BE0dFABcCc2) | Bridge |

### Chariot Protocol -- Ethereum Sepolia (Chain ID: 11155111)

| Contract | Address | Module |
|----------|---------|--------|
| **ETHEscrow** | [`0x42cAA0a88A42b92e1307E625e5253BE0dFABcCc2`](https://sepolia.etherscan.io/address/0x42cAA0a88A42b92e1307E625e5253BE0dFABcCc2) | Bridge |

### External Dependencies -- Arc Testnet

| Contract | Address | Purpose |
|----------|---------|---------|
| **USDC** | `0x3600000000000000000000000000000000000000` | Gas token + lending asset (6 decimals ERC-20, 18 decimals native) |
| **USYC** | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` | Tokenized US Treasury bills (Hashnote, 18 decimals) |
| **USYC Teller** | `0x9fdF14c5B14173D74C08Af27AebFf39240dC105A` | Mint/redeem USYC |
| **USYC Entitlements** | `0xcc205224862c7641930c87679e98999d23c26113` | KYC allowlist for USYC |
| **CCTP TokenMessengerV2** | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` | Circle cross-chain USDC transfers |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Uniswap token approval standard |

## Oracle Integration

Chariot uses SimpleOracle -- an admin-controlled oracle implementing the IStork interface. Prices are set by the protocol admin or automated agent via `setPriceNow(feedId, price)`. This replaces Stork in the MVP since the Stork API is not yet available on Arc Testnet.

| Feed | ID | Purpose | Phase |
|------|----|---------|-------|
| `ETHUSD` | `0x5910...7160` | BridgedETH collateral pricing | MVP |
| `ETHUSD_VGK` | -- | Dynamic LTV + volatility premium | Phase 2 |
| `BTCUSD`, `SOLUSD` | -- | Future multi-collateral pricing | Phase 3 |

The EMA Garman-Klass volatility estimator (Phase 2) incorporates intraperiod price range (high-low) for more accurate volatility measurement than close-to-close calculations.

## Frontend

The frontend is a Next.js 16 app with the App Router. It connects to Arc Testnet and Ethereum Sepolia via RainbowKit + wagmi.

### Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page -- hero section, features grid, how-it-works flow, protocol stats |
| `/dashboard` | Protocol overview -- KPIs with spark charts, vault composition pie chart, utilisation history, interactive rate curve, oracle data, health metrics, liquidation monitoring, top borrowers |
| `/lend` | Deposit/withdraw USDC -- 3-step flow (Amount -> Preview -> Confirm), live position tracking (chUSDC balance, supply APY, earnings) |
| `/borrow` | Collateral management + borrowing -- collateral status, borrow/repay panels, health factor gauge, risk parameter table |
| `/bridge` | Cross-chain ETH bridge -- deposit ETH on Sepolia, monitor relayer minting, claim BridgedETH on Arc |
| `/history` | Transaction history -- filterable log of all user operations |

### Custom Hooks (28 total)

The frontend reads all data directly from on-chain contracts with a 12-second polling interval (~1 Arc block). Zero mock data -- every metric is live.

**Vault:** `useVaultDeposit`, `useVaultWithdraw`, `useVaultMetrics`, `useLenderPosition`
**Borrowing:** `useBorrow`, `useRepay`, `useBorrowerPositions`, `useUserDebt`
**Collateral:** `useCollateralData`, `useWithdrawCollateral`
**Bridge:** `useETHEscrowDeposit`, `useBridgeStatus`, `useBridgeUSDC`, `useCCTPBridgeStatus`
**Pricing & Risk:** `useETHUSDPrice`, `useOraclePrice`, `useHealthFactor`, `useRiskParameters`, `useBorrowRate`, `useRateBreakdown`
**Analytics:** `useProtocolHealth`, `useProtocolKPIs`, `useVaultComposition`, `useUtilisationHistory`, `useSharePriceHistory`, `useYieldHistory`, `useTransactionHistory`, `useCircuitBreakerStatus`

### Design System

- **Palette:** Chariot teal (`#023436`, `#037971`, `#03B5AA`)
- **Border radius:** 0px (flat, modern aesthetic)
- **Layout:** Max-width 1200px, responsive grid
- **Typography:** Red Hat Display (headings) + Red Hat Text (body), self-hosted woff2
- **Components:** shadcn/ui primitives + custom domain components
- **Icons:** Tabler Icons (filled variants preferred)

## Relayer Service

The relayer is a Node.js service that bridges ETH between Ethereum Sepolia and Arc Testnet.

**Deposit flow:**
1. Watches `ETHEscrow.Deposited` events on Sepolia
2. Calls `BridgedETH.mint()` on Arc with the same nonce (replay protection)

**Withdrawal flow:**
1. Watches `BridgedETH.Burned` events on Arc
2. Calls `ETHEscrow.release()` on Sepolia

Nonce-based replay protection prevents double-minting. The relayer maintains in-memory state of processed nonces.

## Vault Management Agent

An autonomous agent manages the dual-yield strategy using a Circle developer-controlled wallet (EOA type, gas-sponsored via Circle Gas Station).

**Monitoring loop** (60-second interval):
1. Reads vault utilisation, USYC yield, and circuit breaker level
2. Runs utility-based decision engine to evaluate rebalance opportunities
3. Executes `ChariotVault.rebalance()` when the utility function favors action
4. Rate-limited to max 3 rebalances per day

**Decision logic:**
- Utilisation < 40%: route idle USDC to USYC
- Utilisation > 80%: redeem USYC back to USDC
- Circuit breaker Level 3: force full USYC redemption
- Otherwise: maximize expected yield via utility scoring

## Key Formulas

```
INTEREST RATES:
  Utilisation:          U = Total_Borrowed / Total_Supplied
  Utilisation Rate:     If U <= 0.8: R_base + R_slope1 * (U / 0.8)
                        If U >  0.8: R_base + R_slope1 + R_slope2 * ((U - 0.8) / 0.2)
  Volatility Premium:   k_vol * max(0, Current_Vol - Baseline_Vol)
  Concentration Premium: max(0, (Asset_Share - 0.40) * k_conc)
  Total Borrow Rate:    Utilisation_Rate + Volatility_Premium + Concentration_Premium
  Supply Rate:          (Borrow_Rate * U * (1 - RF)) + (USYC_Yield * (1 - U) * (1 - SF))

RISK PARAMETERS:
  Effective LTV:        Base_LTV - (k_ltv * max(0, Current_Vol - Baseline_Vol))
  Liquidation Threshold: Effective_LTV + Buffer (7%)
  Health Factor:        (Collateral_Value * Liq_Threshold) / Debt_Value
  Liquidation Bonus:    Base_Bonus + min(5%, max(0, (1.0 - HF) * 50))

VAULT:
  Share Price:          Total_Assets / Total_Shares
  Total Assets:         USDC_in_pool + USDC_lent + USYC_value
  Shares on Deposit:    deposit_amount / share_price
  USDC on Withdrawal:   shares_burned * share_price
```

## Collateral Parameters

| Collateral | Base LTV | Liquidation Threshold | Liquidation Bonus | Volatility Feed | Phase |
|------------|----------|----------------------|-------------------|-----------------|-------|
| BridgedETH | 75% | 82% | 5-10% (scaled) | `ETHUSD_VGK` | MVP |
| BridgedBTC | 75% | 82% | 5-10% (scaled) | `BTCUSD_VGK` | Phase 3 |
| BridgedSOL | 65% | 72% | 8-13% (scaled) | `SOLUSD_VGK` | Phase 3 |
| EURC | 90% | 95% | 2-7% (scaled) | `EURUSD_VGK` | Phase 3 |

## User Journeys

### Lender

1. Connect wallet on Arc Testnet
2. Approve USDC and deposit into ChariotVault
3. Receive chUSDC shares representing pool ownership
4. Earn dual yield: borrow interest + USYC T-bill returns
5. Withdraw anytime: burn chUSDC shares, receive USDC (ERC-4626 redemption)

### Borrower

1. Switch wallet to Ethereum Sepolia
2. Deposit ETH into ETHEscrow contract
3. Relayer mints BridgedETH on Arc (~5-30 seconds)
4. Switch wallet to Arc Testnet
5. Approve and deposit BridgedETH into CollateralManager
6. Borrow USDC against collateral (up to 75% LTV)
7. Repay debt on LendingPool (interest accrues in real-time)
8. Withdraw collateral and bridge ETH back to Ethereum

### Liquidator

1. Monitor health factors on the dashboard
2. Identify undercollateralized positions (health factor < 1.0)
3. Call `LiquidationEngine.liquidate()` with borrower address
4. Repay portion of debt, seize collateral with 5-10% bonus

## License

MIT
