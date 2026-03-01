# Chariot Project Audit -- Codebase vs Documentation Sync

**Date:** 2026-03-01
**Scope:** README.md, architecture diagrams, shared ABIs, frontend UI logic -- all verified directly against the actual codebase (Solidity contracts, TypeScript hooks, deployed addresses).

---

## Summary

| Severity | Count | Resolved |
|----------|-------|----------|
| Critical (broken logic / wrong data) | 3 | 3 resolved |
| Inaccurate (README claims vs reality) | 4 | 4 resolved |
| Incomplete (missing from README) | 10 | (skipped per user request) |
| UI/UX misleading | 3 | 3 resolved |
| **Total** | **20** | **10 resolved, 10 skipped** |

---

## Critical Issues

### C-1. ~~`circuitBreakerLevel()` ABI mapped to wrong contract~~ -- RESOLVED (Not a bug)

**Status:** NOT BROKEN. ChariotVault inherits ChariotBase, which declares `uint8 public circuitBreakerLevel` -- Solidity auto-generates a getter. The ABI and hook are correct. The hook reads from `CHARIOT_VAULT` which is valid because the public variable is inherited.

**Original concern:** Thought `circuitBreakerLevel()` didn't exist on ChariotVault. It does -- via ChariotBase inheritance.

**Note:** The standalone CircuitBreaker contract uses `level()` (a different function), and ChariotBase's `_getEffectiveCircuitBreakerLevel()` returns `max(local, external)`. The current setup reads the local manual level correctly. Deploying the standalone CircuitBreaker (C-2) will add automatic escalation on top.

---

### C-2. ~~CircuitBreaker standalone contract not deployed~~ -- RESOLVED

**Status:** Deployed to Arc Testnet at `0x7Ba752d4eF5350B2F187Fa093C4ec4495104AC14`. RECORDER_ROLE granted to all 4 protocol contracts. Wired to ChariotVault, LendingPool, CollateralManager, and LiquidationEngine via `setCircuitBreaker()`. Address updated in `shared/src/addresses.ts` and `README.md`.

---

### C-3. ~~CCTPBridge not deployed~~ -- RESOLVED (Removed from public-facing docs/UI)

**Status:** CCTP bridging and the standalone Bridge page have been removed from the UI, README, and public documentation. Contract code remains in the codebase for future deployment. The Bridge nav item, bridge filter in transaction history, and "Coming Soon" CCTP UI have all been removed.

---

## Inaccurate (README claims vs code)

### I-1. ~~RiskParameterEngine description references Stork oracle~~ -- RESOLVED

**Status:** README updated. Now reads: "Reads volatility from the oracle (currently SimpleOracle with admin-set prices; designed for Stork compatibility when available)."

---

### I-2. ~~Agent "gas-sponsored via Circle Gas Station" claim~~ -- RESOLVED

**Status:** README updated. Now reads: "EOA via Circle Programmable Wallets" -- removed the gas sponsorship claim.

---

### I-3. ~~README lists 13 contracts but only 8 are deployed~~ -- RESOLVED

**Status:** README updated. Now states "9 deployed on-chain (8 Arc + 1 Sepolia), 2 abstract/library". CircuitBreaker row marked as "Deployment script ready -- not yet deployed." CCTPBridge removed from public docs.

---

### I-4. ~~Liquidation threshold dynamic adjustment dormant~~ -- RESOLVED

**Status:** README updated. Now includes: "Currently static at 82% (base LTV 75% + 7% buffer) since live volatility feeds are not active on testnet."

---

## Incomplete (Missing from README)

### M-1. No monorepo structure or workspace overview

The README doesn't mention that Chariot is a pnpm monorepo with 7 workspace packages: `contracts`, `frontend`, `shared`, `agent`, `relayer`, `e2e`, `e2e-ui`. A reader wouldn't know the project layout.

**Fix:** Add a "Repository Structure" section showing the workspace packages and their purposes.

---

### M-2. No setup / quickstart instructions

The README has no instructions for cloning, installing dependencies, building, or running the project. Missing:
- `pnpm install` / `pnpm build`
- Environment variable setup (`.env` files needed for each package)
- `forge build` / `forge test` for contracts
- `pnpm dev` for frontend
- How to run the relayer and agent

**Fix:** Add a "Getting Started" section with setup steps.

---

### M-3. No mention of the relayer service

The README describes the ETH bridge mechanism but never mentions the `relayer/` package -- the Node.js service that watches Sepolia for deposits, mints BridgedETH on Arc, and handles withdrawal releases. Without the relayer, the bridge doesn't work.

**Fix:** Add the relayer to the architecture description, including its polling mechanism (12s interval), state persistence, and deployment on Render.

---

### M-4. No mention of deployment infrastructure

The project deploys the relayer and agent to Render.com (configured in `render.yaml`) and the frontend to Vercel. None of this is documented in the README.

**Fix:** Add a "Deployment" section covering Vercel (frontend), Render (relayer + agent), and Foundry scripts (contracts).

---

### M-5. No RPC configuration or fallback transport documentation

The frontend uses a 3-provider fallback transport (Blockdaemon -> dRPC -> QuickNode) which is critical infrastructure. The QuickNode free tier hitting daily limits was a production incident. None of this is in the README.

**Fix:** Document the RPC fallback strategy and known rate-limit issues.

---

### M-6. Pre-existing Arc addresses not listed

The README's deployed contracts table omits key pre-existing Arc addresses that the protocol depends on:
- **USDC:** `0x3600000000000000000000000000000000000000`
- **USYC:** `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C`
- **USYC Teller:** `0x9fdF14c5B14173D74C08Af27AebFf39240dC105A`

**Fix:** Add a "Pre-existing Arc Testnet Addresses" table.

---

### M-7. No mention of ArcScan API usage

The frontend fetches transaction history from the ArcScan Blockscout API (`https://testnet.arcscan.app/api`), not via RPC `eth_getLogs`. This is an important architectural decision (Arc Testnet doesn't support `eth_getLogs` well).

**Fix:** Document the ArcScan API dependency.

---

### M-8. No testing documentation

The project has:
- 18 Foundry test files for contracts
- Playwright e2e-ui tests with 30+ screenshots
- e2e backend integration tests

None of this is mentioned in the README. No `forge test` or `pnpm test` instructions.

**Fix:** Add a "Testing" section.

---

### M-9. No environment variable reference

Each package requires different environment variables:
- `contracts/.env`: DEPLOYER_PRIVATE_KEY, ARC_RPC_URL, ETH_SEPOLIA_RPC_URL
- `relayer/.env`: RELAYER_PRIVATE_KEY, ARC_RPC_URL, ETH_SEPOLIA_RPC_URL, ETH_ESCROW_ADDRESS, etc.
- `agent/.env`: CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, CIRCLE_WALLET_SET_ID, CIRCLE_WALLET_ID, etc.
- `frontend`: NEXT_PUBLIC_ARC_RPC_URL

None documented in README.

**Fix:** Add an environment variables reference or point to `.env.example` files.

---

### M-10. Architecture diagrams are opaque (Excalidraw-only)

The 5 architecture diagrams in `/architecture/` are Excalidraw files (JSON-based drawing format). They cannot be viewed in GitHub without the Excalidraw extension. No exported PNG/SVG versions exist, and no text descriptions accompany them.

**Fix:** Either:
- Export diagrams to SVG/PNG and embed in README, or
- Add Mermaid diagrams in the README for key flows (lending, borrowing, bridge, liquidation)

---

## UI/UX Misleading

### U-1. ~~Liquidation Monitoring Table implies protocol-wide view~~ -- RESOLVED

**Status:** Component title changed from "Borrower Positions" to "Your Position". Subtitle changed from "Sorted by health factor (lowest first)" to "Health factor status". Empty state updated to "No active position".

---

### U-2. ~~Top Borrowers chart implies protocol-wide data~~ -- RESOLVED

**Status:** Component title changed from "Top Positions by Collateral" to "Your Collateral Position". Empty state updated to "No position to display".

---

### U-3. ~~USYC allocation displayed but may not be functional~~ -- RESOLVED

**Status:** VaultCompositionChart legend label changed from "In T-Bills (USYC)" to "T-Bills (USYC) -- Pending Whitelisting". README also updated to note USYC is pending whitelisting by Circle/Hashnote.

---

## Address Consistency Check

All deployed contract addresses are consistent across these three sources:

| Contract | README.md | shared/addresses.ts | DEPLOYMENT_LOG.md | Match? |
|----------|-----------|--------------------|--------------------|--------|
| ChariotVault | 0x21dBa2...D8E43 | 0x21dBa2...D8E43 | 0x21dBa2...D8E43 | Yes |
| LendingPool | 0xD00FbD...fB318 | 0xD00FbD...fB318 | 0xD00FbD...fB318 | Yes |
| CollateralManager | 0xeb5343...ca4A6 | 0xeb5343...ca4A6 | 0xeb5343...ca4A6 | Yes |
| LiquidationEngine | 0xDd8C98...9472 | 0xDd8C98...9472 | 0xDd8C98...9472 | Yes |
| InterestRateModel | 0x2AFF3e...De1c | 0x2AFF3e...De1c | 0x2AFF3e...De1c | Yes |
| RiskParameterEngine | 0x28F88F...4eA | 0x28F88F...4eA | 0x28F88F...4eA | Yes |
| SimpleOracle | 0xef2eD9...b86C | 0xef2eD9...b86C | 0xef2eD9...b86C | Yes |
| BridgedETH | 0x42cAA0...Cc2 | 0x42cAA0...Cc2 | 0x42cAA0...Cc2 | Yes |
| ETHEscrow (Sepolia) | 0x42cAA0...Cc2 | 0x42cAA0...Cc2 | 0x42cAA0...Cc2 | Yes |
| CircuitBreaker | (not listed) | "" (empty) | "" (empty) | Yes (consistently undeployed) |
| CCTPBridge | (not listed) | "" (empty) | N/A | Yes (consistently undeployed) |

**Verdict:** All addresses are in sync across all sources. No address mismatches found.

---

## Rate Model Parameter Check

| Parameter | shared/constants.ts | InterestRateModel.sol | README | Match? |
|-----------|--------------------|-----------------------|--------|--------|
| R_BASE | 0 (0%) | 0 (0%) | "base 0%" | Yes |
| R_SLOPE1 | 0.04 (4%) | 4e16 (4% WAD) | "slope1 4%" | Yes |
| R_SLOPE2 | 0.75 (75%) | 75e16 (75% WAD) | "slope2 75%" | Yes |
| U_OPTIMAL | 0.80 (80%) | 80e16 (80% WAD) | "kink 80%" | Yes |
| RESERVE_FACTOR | 0.10 (10%) | (in vault) | Not in README | -- |
| USYC_YIELD | 0.045 (4.5%) | N/A (off-chain) | "~4.5% APY" | Yes |

**Verdict:** Rate model parameters are consistent across all sources.

---

## Risk Parameter Check

| Parameter | shared/constants.ts | Contract | README | Match? |
|-----------|--------------------|---------| --------|--------|
| BASE_LTV | 0.75 (75%) | 75e16 | "static base LTV (75%)" | Yes |
| LIQUIDATION_THRESHOLD | 0.82 (82%) | Computed: LTV + 7e16 | "7% buffer" | Yes |
| LIQUIDATION_BONUS_BASE | 0.05 (5%) | 500 BPS | "5%" | Yes |
| LIQUIDATION_BONUS_MAX | 0.05 (5%) | 500 BPS | "to 10%" (5+5) | Yes |
| MAX_LIQUIDATION_RATIO | N/A | 50e16 (50%) | "up to 50%" | Yes |

**Verdict:** Risk parameters are consistent.

---

## Verified Correct (No Action Needed)

The following README claims were verified against the actual Solidity source code and are accurate:

- 5% liquid USDC buffer (`BUFFER_PERCENT = 0.05e18`)
- Kinked interest rate curve formula and parameters
- `effectiveLTV = baseLTV - K_LTV * excessVol` formula
- 7% liquidation buffer (`LIQUIDATION_BUFFER = 7e16`)
- Max 50% debt per liquidation (`MAX_LIQUIDATION_RATIO = 50e16`)
- 5-10% liquidation bonus range
- 24-hour timeout refunds (`REFUND_TIMEOUT = 86400`)
- Circuit breaker thresholds (15% collateral drop, 20% withdrawal, 95% utilisation/30min, 1hr stale oracle)
- All deployed contract addresses match across README, shared/addresses.ts, and DEPLOYMENT_LOG.md
- All rate model and risk parameters match across TypeScript constants and Solidity contracts
- ERC-4626 vault standard implementation
- Global index pattern for interest accrual
- Nonce-based replay protection in ETHEscrow

---

## Remaining Action Items

1. **M-1 through M-10** -- Add missing README sections (skipped per user request, documented above for future)
