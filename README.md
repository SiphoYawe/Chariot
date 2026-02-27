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

Chariot is a crosschain collateral lending protocol deployed on Arc. Borrowers deposit ETH on Ethereum as collateral, which is bridged to Arc via a custom ETHEscrow bridge, and borrow USDC against it at dynamic, risk-adjusted rates. Lenders deposit USDC into an ERC-4626 vault and earn yield from two simultaneous sources: borrower interest payments and T-bill returns on idle capital via USYC.

Arc serves as the central clearing hub -- all lending, borrowing, and liquidation happens on Arc with sub-second deterministic finality and ~$0.01 transaction fees.

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

Borrow rates combine three independently calculated components:

```
Total_Borrow_Rate = Utilisation_Rate + Volatility_Premium + Concentration_Premium
```

**Utilisation rate** uses an Aave V3-style kinked model with an optimal utilisation target of 80%. Below the kink, rates increase gently. Above the kink, rates spike aggressively to rebalance supply and demand.

**Volatility premium** (Phase 2) charges higher rates for borrowing against volatile collateral, using Stork EMA Garman-Klass volatility feeds.

**Concentration premium** (Phase 3) charges higher rates when a single collateral type exceeds 40% of total collateral value.

### Volatility-Adjusted Risk Parameters

LTV ratios and liquidation thresholds adjust dynamically based on real-time Stork oracle volatility feeds:

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

The bridge uses nonce-based replay protection and the same attestation pattern as Circle CCTP.

### Liquidation Engine

Positions with a health factor below 1.0 are liquidatable:

```
Health_Factor = (Collateral_Value * Liquidation_Threshold) / Debt_Value
```

Liquidators fetch fresh signed prices from Stork's API and submit them as part of the liquidation transaction. The price update and liquidation execute atomically -- zero staleness. Liquidation bonuses scale from 5% to 10% based on how underwater the position is.

### Circuit Breakers

Three-level protection system modeled after stock exchange circuit breakers:

| Level | Trigger | Action |
|-------|---------|--------|
| **Level 1** | Collateral value drops >15% in 1 hour | Pause new borrows |
| **Level 2** | Withdrawals exceed 20% of pool in 1 hour | Rate-limit withdrawals |
| **Level 3** | Utilisation >95% for >30 minutes or oracle failure | Emergency mode -- admin multisig required to resume |

### USDC Outflow via CCTP

Borrowed USDC can be bridged from Arc to any CCTP-supported chain (Ethereum, Base, Arbitrum) using Circle's Cross-Chain Transfer Protocol.

## Technical Stack

### Smart Contracts

| Component | Technology |
|-----------|-----------|
| Language | Solidity ^0.8.30 (Prague EVM target) |
| Framework | Foundry (forge, cast, anvil) |
| Standards | ERC-4626 (vault), ERC-20 (collateral tokens, USDC) |
| Oracle SDK | `@storknetwork/stork-evm-sdk` |
| Network | Arc Testnet (Chain ID: 5042002) |

### Backend

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js / TypeScript |
| Circle SDK | `@circle-fin/smart-contract-platform`, `@circle-fin/w3s` |
| Oracle Data | Stork REST API + WebSocket |
| Wallet Management | Circle Developer-Controlled Wallets |
| Gas Sponsoring | Circle Gas Station (ERC-4337) |

### Frontend

| Component | Technology |
|-----------|-----------|
| Framework | React / Next.js |
| Wallet Connection | wagmi + viem |
| Networks | Arc Testnet + Ethereum Sepolia |

## Smart Contract Architecture

| Contract | Responsibility |
|----------|---------------|
| **ChariotVault** | ERC-4626 vault. Accepts USDC deposits, issues chUSDC shares, manages dual-yield strategy (lending pool vs USYC). |
| **LendingPool** | Holds lendable USDC. Processes borrow/repay transactions. Accrues interest. |
| **CollateralManager** | Holds borrower collateral. Tracks per-user balances. Calculates health factors using oracle prices and dynamic risk parameters. |
| **LiquidationEngine** | Verifies health factor < 1.0, calculates bonus, transfers collateral to liquidator, reduces borrower debt. |
| **InterestRateModel** | Computes borrow rate from utilisation + volatility + concentration inputs. |
| **RiskParameterEngine** | Reads Stork volatility feeds. Computes effective LTV and liquidation threshold per collateral type. |
| **CircuitBreaker** | Monitors protocol metrics. Enforces withdrawal rate limits and borrow pauses. |
| **ETHEscrow** | Lock contract for native ETH on Ethereum Sepolia with timeout-based refunds. |
| **BridgedETH** | ERC-20 on Arc minted by relayer, burnable for ETH release on Ethereum. |

## Oracle Integration (Stork)

Stork operates as a pull oracle on Arc (`0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62`). Data is only written on-chain when a transaction needs it.

| Feed | Purpose | Phase |
|------|---------|-------|
| `ETHUSD` | BridgedETH collateral pricing | MVP |
| `ETHUSD_VGK` | Dynamic LTV + volatility premium | Phase 2 |
| `BTCUSD`, `SOLUSD` | Future collateral pricing | Phase 3 |
| `BTCUSD_VGK`, `SOLUSD_VGK` | Future multi-collateral risk parameters | Phase 3 |

Stork's EMA Garman-Klass volatility estimator incorporates intraperiod price range (high-low) for more accurate volatility measurement than close-to-close calculations.

## Key Contract Addresses (Arc Testnet)

| Contract | Address |
|----------|---------|
| USDC | `0x3600000000000000000000000000000000000000` |
| USYC | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` |
| USYC Teller | `0x9fdF14c5B14173D74C08Af27AebFf39240dC105A` |
| Stork Oracle | `0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62` |
| CCTP TokenMessengerV2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |

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
| BridgedETH | 75% | 82% | 5% | `ETHUSD_VGK` | MVP |
| BridgedBTC | 75% | 82% | 5% | `BTCUSD_VGK` | Phase 3 |
| BridgedSOL | 65% | 72% | 8% | `SOLUSD_VGK` | Phase 3 |
| EURC | 90% | 95% | 2% | `EURUSD_VGK` | Phase 3 |

## Vault Management Agent

An autonomous agent manages the dual-yield strategy using a Circle developer-controlled wallet. The agent monitors pool utilisation and USYC yields, then executes rebalancing decisions using a utility-based framework:

- Routes idle USDC to USYC when utilisation is below target
- Redeems USYC back to USDC when borrowing demand increases
- Triggers full USYC redemption during circuit breaker events
- Operates with gas sponsored by Circle Gas Station

## License

MIT
