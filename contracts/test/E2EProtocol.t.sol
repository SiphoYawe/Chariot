// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {ChariotVault} from "../src/core/ChariotVault.sol";
import {LendingPool} from "../src/core/LendingPool.sol";
import {CollateralManager} from "../src/core/CollateralManager.sol";
import {LiquidationEngine} from "../src/core/LiquidationEngine.sol";
import {InterestRateModel} from "../src/risk/InterestRateModel.sol";
import {RiskParameterEngine} from "../src/risk/RiskParameterEngine.sol";
import {CircuitBreaker} from "../src/risk/CircuitBreaker.sol";
import {BridgedETH} from "../src/bridge/BridgedETH.sol";
import {CCTPBridge} from "../src/bridge/CCTPBridge.sol";
import {ETHEscrow} from "../src/bridge/ETHEscrow.sol";
import {ChariotBase} from "../src/base/ChariotBase.sol";
import {ILendingPool} from "../src/interfaces/ILendingPool.sol";
import {ICollateralManager} from "../src/interfaces/ICollateralManager.sol";
import {ICircuitBreaker} from "../src/interfaces/ICircuitBreaker.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockStork} from "./mocks/MockStork.sol";
import {MockUSYCTeller} from "./mocks/MockUSYCTeller.sol";
import {MockTokenMessengerV2} from "./mocks/MockTokenMessengerV2.sol";
import {IETHEscrow} from "../src/interfaces/IETHEscrow.sol";
import {ICCTPBridge} from "../src/interfaces/ICCTPBridge.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StorkStructs} from "@stork-oracle/StorkStructs.sol";

/// @title E2EProtocolTest -- End-to-end tests proving all Chariot contracts work together
/// @notice Comprehensive E2E test suite that exercises every contract in connected
///         transaction flows: vault, lending, collateral, liquidation, bridge, oracle,
///         circuit breaker, risk engine, and interest rate model.
contract E2EProtocolTest is Test {
    // -- Core Contracts --
    ChariotVault public vault;
    LendingPool public pool;
    CollateralManager public collateralManager;
    LiquidationEngine public liquidationEngine;
    InterestRateModel public rateModel;
    RiskParameterEngine public riskEngine;
    CircuitBreaker public circuitBreaker;

    // -- Bridge Contracts --
    BridgedETH public bridgedETH;
    CCTPBridge public cctpBridge;
    ETHEscrow public ethEscrow;

    // -- Mocks --
    MockERC20 public usdc;
    MockERC20 public usyc;
    MockStork public stork;
    MockUSYCTeller public teller;
    MockTokenMessengerV2 public messenger;

    // -- Actors --
    address public admin = makeAddr("admin");
    address public alice = makeAddr("alice"); // Lender + depositor
    address public bob = makeAddr("bob"); // Borrower
    address public charlie = makeAddr("charlie"); // Liquidator
    address public dave = makeAddr("dave"); // Second borrower
    address public relayer = makeAddr("relayer"); // Bridge relayer

    // -- Constants --
    uint256 constant USDC_UNIT = 1e6;
    uint256 constant WAD = 1e18;
    int192 constant ETH_PRICE = 2000e18; // $2,000
    bytes32 constant ETHUSD_FEED_ID = 0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160;
    bytes32 constant ETH_VOL_FEED_ID = keccak256("ETHVOL");
    uint32 constant DOMAIN_ETHEREUM = 0;

    StorkStructs.TemporalNumericValueInput[] emptyUpdates;

    function setUp() public {
        vm.warp(100_000);

        // ========================================
        // 1. Deploy all tokens and mocks
        // ========================================
        usdc = new MockERC20("USD Coin", "USDC", 6);
        usyc = new MockERC20("US Yield Coin", "USYC", 6);
        stork = new MockStork();
        teller = new MockUSYCTeller(address(usdc), address(usyc), 1e18);
        messenger = new MockTokenMessengerV2(address(usdc));

        // ========================================
        // 2. Deploy all protocol contracts
        // ========================================
        bridgedETH = new BridgedETH(admin, relayer);
        ethEscrow = new ETHEscrow(relayer);
        rateModel = new InterestRateModel();
        riskEngine = new RiskParameterEngine(address(stork), admin);
        circuitBreaker = new CircuitBreaker(admin);
        vault = new ChariotVault(address(usdc), address(usyc), address(teller), address(stork), admin);
        collateralManager = new CollateralManager(address(bridgedETH), address(stork), admin);
        pool = new LendingPool(address(usdc), address(stork), admin);
        liquidationEngine = new LiquidationEngine(address(usdc), address(stork), admin);
        cctpBridge = new CCTPBridge(address(messenger), address(usdc), admin);

        // ========================================
        // 3. Wire all dependencies
        // ========================================

        // InterestRateModel grants admin to deployer (this contract).
        // Grant admin role to our admin address so it can configure from startPrank.
        rateModel.grantRole(rateModel.DEFAULT_ADMIN_ROLE(), admin);

        vm.startPrank(admin);

        // LendingPool wiring
        pool.setInterestRateModel(address(rateModel));
        pool.setCollateralManager(address(collateralManager));
        pool.setVault(address(vault));
        pool.setCCTPBridge(address(cctpBridge));
        pool.setPrimaryCollateralToken(address(bridgedETH));

        // CollateralManager wiring
        collateralManager.setLendingPool(address(pool));
        collateralManager.setRiskParameterEngine(address(riskEngine));

        // LiquidationEngine wiring
        liquidationEngine.setLendingPool(address(pool));
        liquidationEngine.setCollateralManager(address(collateralManager));
        liquidationEngine.setVault(address(vault));

        // RiskParameterEngine configuration
        riskEngine.setBaseLTV(address(bridgedETH), 0.75e18); // 75%
        riskEngine.setVolatilityFeedId(address(bridgedETH), ETH_VOL_FEED_ID);

        // InterestRateModel volatility wiring
        rateModel.setRiskParameterEngine(address(riskEngine));
        rateModel.setKVolCoefficient(address(bridgedETH), 0.5e18); // kVol = 0.5

        // Grant roles
        vault.grantRole(vault.LENDING_POOL_ROLE(), address(pool));
        pool.grantRole(pool.LIQUIDATION_ENGINE_ROLE(), address(liquidationEngine));
        collateralManager.grantRole(collateralManager.LIQUIDATION_ENGINE_ROLE(), address(liquidationEngine));

        // CircuitBreaker roles
        circuitBreaker.grantRole(circuitBreaker.RECORDER_ROLE(), admin);

        vm.stopPrank();

        // ========================================
        // 4. Set oracle prices
        // ========================================
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);
        stork.setPriceNow(ETH_VOL_FEED_ID, int192(int256(25e16))); // 25% baseline vol

        // ========================================
        // 5. Fund actors
        // ========================================
        // Alice: 1M USDC (lender/depositor)
        usdc.mint(alice, 1_000_000 * USDC_UNIT);

        // Bob: 10 ETH collateral + 100k USDC for repayments
        vm.prank(relayer);
        bridgedETH.mint(bob, 10 ether, 0);
        usdc.mint(bob, 100_000 * USDC_UNIT);

        // Charlie: 100k USDC (liquidator) + some ETH
        usdc.mint(charlie, 100_000 * USDC_UNIT);
        vm.prank(relayer);
        bridgedETH.mint(charlie, 5 ether, 1);

        // Dave: 5 ETH + 50k USDC
        vm.prank(relayer);
        bridgedETH.mint(dave, 5 ether, 2);
        usdc.mint(dave, 50_000 * USDC_UNIT);

        // Fund teller with USDC for redemptions
        usdc.mint(address(teller), 1_000_000 * USDC_UNIT);
    }

    // ================================================================
    // E2E Test 1: Full Lending Lifecycle
    // Deposit USDC -> Deposit Collateral -> Borrow -> Interest Accrues
    // -> Repay with interest -> Withdraw Collateral -> Withdraw USDC
    // ================================================================

    function test_e2e_fullLendingLifecycle() public {
        // -- Step 1: Alice deposits 500k USDC into the vault --
        vm.startPrank(alice);
        usdc.approve(address(vault), 500_000 * USDC_UNIT);
        uint256 aliceShares = vault.deposit(500_000 * USDC_UNIT, alice);
        vm.stopPrank();

        assertEq(vault.totalAssets(), 500_000 * USDC_UNIT, "Vault should hold 500k USDC");
        assertEq(vault.balanceOf(alice), aliceShares, "Alice should have shares");
        assertGt(aliceShares, 0, "Shares must be positive");

        // -- Step 2: Bob deposits 10 ETH collateral --
        vm.startPrank(bob);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 10 ether);
        vm.stopPrank();

        assertEq(collateralManager.getCollateralBalance(bob, address(bridgedETH)), 10 ether);

        // -- Step 3: Bob borrows 10,000 USDC --
        // 10 ETH * $2000 = $20,000 collateral; 75% LTV = max $15,000
        uint256 borrowAmount = 10_000 * USDC_UNIT;
        uint256 bobBalBefore = usdc.balanceOf(bob);

        vm.startPrank(bob);
        usdc.approve(address(pool), type(uint256).max);
        pool.borrow(address(bridgedETH), borrowAmount, emptyUpdates);
        vm.stopPrank();

        assertEq(pool.getUserDebt(bob), borrowAmount, "Bob debt should be 10k USDC");
        assertEq(usdc.balanceOf(bob), bobBalBefore + borrowAmount, "Bob should receive USDC");
        assertEq(pool.getTotalBorrowed(), borrowAmount, "Total borrowed should be 10k");
        assertEq(vault.totalLent(), borrowAmount, "Vault should track lent amount");

        // -- Step 4: Time passes (90 days) -- interest accrues --
        vm.warp(block.timestamp + 90 days);
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE); // Refresh oracle
        stork.setPriceNow(ETH_VOL_FEED_ID, int192(int256(25e16)));

        // Trigger accrual via a view-then-state call
        vm.prank(bob);
        pool.repay(1); // Micro repay triggers accrual

        uint256 debtAfterInterest = pool.getUserDebt(bob);
        assertGt(debtAfterInterest, borrowAmount - 1, "Debt should grow with interest");

        // -- Step 5: Bob repays full debt --
        vm.prank(bob);
        pool.repayFull();

        assertEq(pool.getUserDebt(bob), 0, "Bob debt should be zero after repayFull");
        assertEq(pool.getTotalBorrowed(), 0, "Total borrowed should be zero");

        // -- Step 6: Bob withdraws all collateral --
        vm.prank(bob);
        collateralManager.withdrawCollateral(address(bridgedETH), 10 ether);

        assertEq(bridgedETH.balanceOf(bob), 10 ether, "Bob should get all ETH back");
        assertEq(collateralManager.getCollateralBalance(bob, address(bridgedETH)), 0);

        // -- Step 7: Alice withdraws USDC (should have earned interest) --
        uint256 aliceUSDCValue = vault.convertToAssets(vault.balanceOf(alice));
        assertGe(aliceUSDCValue, 500_000 * USDC_UNIT, "Alice should have at least her deposit back");

        vm.startPrank(alice);
        vault.redeem(vault.balanceOf(alice), alice, alice);
        vm.stopPrank();

        assertEq(vault.balanceOf(alice), 0, "Alice shares should be zero");
    }

    // ================================================================
    // E2E Test 2: Liquidation Lifecycle
    // Deposit -> Borrow max -> Price drops -> Liquidation -> Verify state
    // ================================================================

    function test_e2e_liquidationLifecycle() public {
        // -- Setup: Alice provides liquidity --
        vm.startPrank(alice);
        usdc.approve(address(vault), 500_000 * USDC_UNIT);
        vault.deposit(500_000 * USDC_UNIT, alice);
        vm.stopPrank();

        // -- Step 1: Bob deposits 10 ETH and borrows max --
        vm.startPrank(bob);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 10 ether);
        usdc.approve(address(pool), type(uint256).max);
        // 10 ETH * $2000 * 75% LTV = $15,000 max
        pool.borrow(address(bridgedETH), 15_000 * USDC_UNIT, emptyUpdates);
        vm.stopPrank();

        assertEq(pool.getUserDebt(bob), 15_000 * USDC_UNIT);

        // -- Step 2: ETH price drops to $1,500 -> HF drops below 1.0 --
        // Collateral: 10 ETH * $1500 = $15,000
        // HF = ($15,000 * 0.82) / $15,000 = 0.82 < 1.0
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(1500e18)));
        stork.setPriceNow(ETH_VOL_FEED_ID, int192(int256(25e16)));

        // Verify position is liquidatable
        assertTrue(liquidationEngine.isLiquidatable(bob), "Bob should be liquidatable");

        // -- Step 3: Charlie liquidates $5,000 of Bob's debt --
        uint256 charlieETHBefore = bridgedETH.balanceOf(charlie);
        uint256 bobDebtBefore = pool.getUserDebt(bob);

        vm.startPrank(charlie);
        usdc.approve(address(liquidationEngine), type(uint256).max);
        liquidationEngine.liquidate(bob, address(bridgedETH), 5_000 * USDC_UNIT, emptyUpdates);
        vm.stopPrank();

        // -- Step 4: Verify post-liquidation state --
        uint256 bobDebtAfter = pool.getUserDebt(bob);
        uint256 charlieETHAfter = bridgedETH.balanceOf(charlie);

        assertLt(bobDebtAfter, bobDebtBefore, "Bob's debt should decrease");
        assertEq(bobDebtBefore - bobDebtAfter, 5_000 * USDC_UNIT, "Debt reduced by repay amount");
        assertGt(charlieETHAfter, charlieETHBefore, "Charlie should receive seized ETH");

        // Liquidator bonus: Charlie should receive more ETH than the bare debt value
        // $5000 at $1500/ETH = 3.333 ETH base, plus bonus
        uint256 ethSeized = charlieETHAfter - charlieETHBefore;
        uint256 baseSeizure = (5_000 * WAD * WAD) / (1500 * WAD); // ~3.333 ETH in WAD
        assertGt(ethSeized, baseSeizure, "Seized ETH should include liquidation bonus");

        // Bob's collateral should be reduced
        uint256 bobCollateralAfter = collateralManager.getCollateralBalance(bob, address(bridgedETH));
        assertLt(bobCollateralAfter, 10 ether, "Bob's collateral should decrease");
    }

    // ================================================================
    // E2E Test 3: Full Bridge Lifecycle
    // ETHEscrow deposit -> BridgedETH mint -> Collateral deposit ->
    // BorrowAndBridge -> Repay -> Burn BridgedETH -> Release ETH
    // ================================================================

    function test_e2e_fullBridgeLifecycle() public {
        // -- Setup: Alice provides liquidity --
        vm.startPrank(alice);
        usdc.approve(address(vault), 500_000 * USDC_UNIT);
        vault.deposit(500_000 * USDC_UNIT, alice);
        vm.stopPrank();

        address bridgeUser = makeAddr("bridgeUser");
        vm.deal(bridgeUser, 5 ether);

        // -- Step 1: User locks ETH in ETHEscrow on Sepolia --
        vm.prank(bridgeUser);
        ethEscrow.deposit{value: 5 ether}();

        assertEq(ethEscrow.getCurrentNonce(), 1, "Nonce should increment");
        IETHEscrow.DepositInfo memory depositInfo = ethEscrow.getDeposit(0);
        assertEq(depositInfo.depositor, bridgeUser);
        assertEq(depositInfo.amount, 5 ether);
        assertEq(uint8(depositInfo.status), uint8(IETHEscrow.DepositStatus.Pending));

        // -- Step 2: Relayer mints BridgedETH on Arc --
        vm.prank(relayer);
        bridgedETH.mint(bridgeUser, 5 ether, 10); // nonce 10

        assertEq(bridgedETH.balanceOf(bridgeUser), 5 ether);
        assertTrue(bridgedETH.isNonceProcessed(10));

        // -- Step 3: User deposits collateral and borrows + bridges --
        vm.startPrank(bridgeUser);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 5 ether);
        vm.stopPrank();

        // BorrowAndBridge: borrow 3000 USDC and bridge to Ethereum
        bytes32 recipient = bytes32(uint256(uint160(bridgeUser)));

        vm.prank(bridgeUser);
        pool.borrowAndBridge(address(bridgedETH), 3000 * USDC_UNIT, DOMAIN_ETHEREUM, recipient, emptyUpdates);

        assertEq(pool.getUserDebt(bridgeUser), 3000 * USDC_UNIT, "Debt recorded");
        assertEq(messenger.lastAmount(), 3000 * USDC_UNIT, "USDC bridged via CCTP");
        assertEq(messenger.lastDestinationDomain(), DOMAIN_ETHEREUM);
        assertEq(messenger.lastMintRecipient(), recipient);

        // -- Step 4: Repay debt --
        usdc.mint(bridgeUser, 3000 * USDC_UNIT); // Give USDC for repayment
        vm.startPrank(bridgeUser);
        usdc.approve(address(pool), type(uint256).max);
        pool.repayFull();
        vm.stopPrank();

        assertEq(pool.getUserDebt(bridgeUser), 0);

        // -- Step 5: Withdraw collateral and burn BridgedETH --
        vm.startPrank(bridgeUser);
        collateralManager.withdrawCollateral(address(bridgedETH), 5 ether);
        bridgedETH.burn(5 ether);
        vm.stopPrank();

        assertEq(bridgedETH.balanceOf(bridgeUser), 0, "All BridgedETH burned");

        // -- Step 6: Relayer releases ETH from escrow on Sepolia --
        vm.prank(relayer);
        ethEscrow.release(bridgeUser, 5 ether, 0);

        IETHEscrow.DepositInfo memory releasedInfo = ethEscrow.getDeposit(0);
        assertEq(uint8(releasedInfo.status), uint8(IETHEscrow.DepositStatus.Released));
        assertEq(bridgeUser.balance, 5 ether, "User gets ETH back");
    }

    // ================================================================
    // E2E Test 4: Vault Rebalance + USYC Yield Strategy
    // Deposit -> Rebalance to USYC -> USYC appreciates -> Verify
    // total assets -> Withdraw with profit
    // ================================================================

    function test_e2e_vaultRebalanceAndUSYCYield() public {
        // -- Step 1: Alice deposits 100k USDC --
        vm.startPrank(alice);
        usdc.approve(address(vault), 100_000 * USDC_UNIT);
        vault.deposit(100_000 * USDC_UNIT, alice);
        vm.stopPrank();

        uint256 totalBefore = vault.totalAssets();
        assertEq(totalBefore, 100_000 * USDC_UNIT);

        // -- Step 2: Admin rebalances -- excess USDC goes to USYC --
        vm.prank(admin);
        vault.rebalance();

        // 5% buffer = 5,000 USDC stays idle, 95,000 USDC goes to USYC
        uint256 idleAfter = usdc.balanceOf(address(vault));
        uint256 usycBalance = usyc.balanceOf(address(vault));

        assertApproxEqAbs(idleAfter, 5_000 * USDC_UNIT, 1, "5% buffer should remain");
        assertApproxEqAbs(usycBalance, 95_000 * USDC_UNIT, 1, "95% should be in USYC");

        // Total assets should be unchanged after rebalance
        assertEq(vault.totalAssets(), totalBefore, "Total assets unchanged after rebalance");

        // -- Step 3: USYC appreciates by 4.5% --
        teller.setPrice(1.045e18);

        // USYC value: 95,000 * 1.045 = 99,275 USDC
        uint256 expectedTotal = idleAfter + ((usycBalance * 1.045e18) / 1e18);
        assertEq(vault.totalAssets(), expectedTotal, "Total should include USYC appreciation");
        assertGt(vault.totalAssets(), totalBefore, "Total should increase with USYC yield");

        // -- Step 4: Rebalance again -- USYC appreciated so idle is below buffer --
        // The vault needs liquidity to allow withdrawal, so rebalance redeems USYC
        vm.prank(admin);
        vault.rebalance();

        // -- Step 5: Verify Alice's share value increased and she can withdraw --
        uint256 aliceValueNow = vault.convertToAssets(vault.balanceOf(alice));
        assertGt(aliceValueNow, 100_000 * USDC_UNIT, "Alice should have profit from USYC yield");

        // Withdraw only the available idle USDC to demonstrate value gain
        uint256 idleAvailable = usdc.balanceOf(address(vault));
        assertGt(idleAvailable, 5_000 * USDC_UNIT, "Should have idle USDC from rebalance");

        // Partial redeem to prove shares are worth more
        uint256 sharesToRedeem = vault.convertToShares(idleAvailable);
        vm.startPrank(alice);
        uint256 assetsReceived = vault.redeem(sharesToRedeem, alice, alice);
        vm.stopPrank();

        assertGt(assetsReceived, 0, "Should receive USDC");
        // Per-share value should be > 1.0 (appreciation)
        assertGt(vault.convertToAssets(USDC_UNIT), USDC_UNIT, "Share price should be > 1.0");
    }

    // ================================================================
    // E2E Test 5: Dynamic Risk Parameters with Volatility
    // Normal vol -> borrow at 75% LTV -> Vol increases -> LTV drops
    // -> Cannot borrow more -> Vol drops -> Can borrow again
    // ================================================================

    function test_e2e_dynamicRiskParametersWithVolatility() public {
        // -- Setup --
        vm.startPrank(alice);
        usdc.approve(address(vault), 500_000 * USDC_UNIT);
        vault.deposit(500_000 * USDC_UNIT, alice);
        vm.stopPrank();

        vm.startPrank(bob);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 10 ether);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();

        // -- Step 1: At baseline volatility (25%), effective LTV = 75% --
        uint256 effectiveLTV = collateralManager.getEffectiveLTV();
        assertEq(effectiveLTV, 0.75e18, "LTV should be 75% at baseline vol");

        // Bob borrows $14,000 (within 75% LTV of $20,000 collateral)
        vm.prank(bob);
        pool.borrow(address(bridgedETH), 14_000 * USDC_UNIT, emptyUpdates);
        assertEq(pool.getUserDebt(bob), 14_000 * USDC_UNIT);

        // -- Step 2: Volatility spikes to 50% -> LTV drops --
        stork.setPriceNow(ETH_VOL_FEED_ID, int192(int256(50e16))); // 50% vol

        uint256 newLTV = collateralManager.getEffectiveLTV();
        // adjustment = 0.5 * (0.50 - 0.25) = 0.125 = 12.5%
        // effectiveLTV = 75% - 12.5% = 62.5%
        assertEq(newLTV, 0.625e18, "LTV should drop to 62.5% at 50% vol");

        // Max borrow at new LTV: $20,000 * 62.5% = $12,500
        // Bob already has $14,000 debt > $12,500 -- cannot borrow more
        vm.prank(bob);
        vm.expectRevert(ILendingPool.ExceedsLTV.selector);
        pool.borrow(address(bridgedETH), 1 * USDC_UNIT, emptyUpdates);

        // -- Step 3: Volatility calms to 20% (below baseline) -> LTV restored to 75% --
        stork.setPriceNow(ETH_VOL_FEED_ID, int192(int256(20e16)));

        uint256 restoredLTV = collateralManager.getEffectiveLTV();
        assertEq(restoredLTV, 0.75e18, "LTV restored to 75% when vol below baseline");

        // Bob can now borrow more (max $15,000 - $14,000 = $1,000)
        vm.prank(bob);
        pool.borrow(address(bridgedETH), 1_000 * USDC_UNIT, emptyUpdates);
        assertEq(pool.getUserDebt(bob), 15_000 * USDC_UNIT);

        // -- Step 4: Verify liquidation threshold also moves with volatility --
        stork.setPriceNow(ETH_VOL_FEED_ID, int192(int256(50e16))); // 50% vol

        uint256 liqThreshold = collateralManager.getLiquidationThreshold();
        // threshold = effectiveLTV + 7% = 62.5% + 7% = 69.5%
        assertEq(liqThreshold, 0.695e18, "Liq threshold should be LTV + 7%");

        // Repay to clean up
        vm.prank(bob);
        pool.repayFull();
    }

    // ================================================================
    // E2E Test 6: Interest Rate Model with Volatility Premium
    // Normal rates -> Utilisation changes -> Vol premium kicks in
    // ================================================================

    function test_e2e_interestRateWithVolatilityPremium() public {
        // -- Setup --
        vm.startPrank(alice);
        usdc.approve(address(vault), 500_000 * USDC_UNIT);
        vault.deposit(500_000 * USDC_UNIT, alice);
        vm.stopPrank();

        vm.startPrank(bob);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 10 ether);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();

        // -- Step 1: Bob borrows to create utilisation --
        vm.prank(bob);
        pool.borrow(address(bridgedETH), 10_000 * USDC_UNIT, emptyUpdates);

        // Utilisation: 10,000 / 500,000 = 2%
        uint256 utilisation = rateModel.getUtilisation(10_000 * USDC_UNIT, 500_000 * USDC_UNIT);
        assertEq(utilisation, 0.02e18, "Utilisation should be 2%");

        // -- Step 2: At baseline vol, no premium --
        uint256 baseBorrowRate = rateModel.getBorrowRate(utilisation);
        uint256 premium = rateModel.getVolatilityPremium(address(bridgedETH));
        assertEq(premium, 0, "No premium at baseline vol");

        uint256 totalRate = rateModel.getBorrowRateWithVolatility(utilisation, address(bridgedETH));
        assertEq(totalRate, baseBorrowRate, "Total rate equals base rate at baseline vol");

        // -- Step 3: Spike volatility to 45% -> premium kicks in --
        stork.setPriceNow(ETH_VOL_FEED_ID, int192(int256(45e16))); // 45% vol

        uint256 newPremium = rateModel.getVolatilityPremium(address(bridgedETH));
        // premium = kVol * (currentVol - baseline) = 0.5 * (0.45 - 0.25) = 0.10 = 10%
        assertEq(newPremium, 0.1e18, "Premium should be 10% at 45% vol");

        uint256 newTotalRate = rateModel.getBorrowRateWithVolatility(utilisation, address(bridgedETH));
        assertEq(newTotalRate, baseBorrowRate + newPremium, "Total = base + premium");

        // -- Step 4: Verify rate breakdown --
        (uint256 baseR, uint256 volPremium, uint256 totalR) =
            rateModel.getRateBreakdown(utilisation, address(bridgedETH));
        assertEq(baseR, baseBorrowRate);
        assertEq(volPremium, newPremium);
        assertEq(totalR, baseBorrowRate + newPremium);

        // Repay to clean up
        vm.prank(bob);
        pool.repayFull();
    }

    // ================================================================
    // E2E Test 7: Circuit Breaker Full Lifecycle
    // Normal ops -> Level 1 (collateral drop) -> Auto-recovery ->
    // Level 2 (withdrawal rate) -> Level 3 (manual) -> Admin resume
    // ================================================================

    function test_e2e_circuitBreakerFullLifecycle() public {
        // -- Step 1: Verify starts at Inactive --
        assertEq(uint8(circuitBreaker.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Inactive));

        // -- Step 2: Record collateral values -- establish a peak --
        vm.startPrank(admin);
        circuitBreaker.recordCollateralValue(10_000e6); // $10,000
        vm.stopPrank();

        // -- Step 3: 16% collateral drop triggers Level 1 (Caution) --
        vm.prank(admin);
        circuitBreaker.recordCollateralValue(8_400e6); // 16% drop

        assertEq(
            uint8(circuitBreaker.level()),
            uint8(ICircuitBreaker.CircuitBreakerLevel.Caution),
            "Should be Caution after 16% drop"
        );

        // -- Step 4: Wait 30 min with stable values -> auto-recovery --
        vm.warp(block.timestamp + 31 minutes);
        vm.prank(admin);
        circuitBreaker.recordCollateralValue(8_400e6); // Still stable

        assertEq(
            uint8(circuitBreaker.level()),
            uint8(ICircuitBreaker.CircuitBreakerLevel.Inactive),
            "Should auto-recover to Inactive"
        );

        // -- Step 5: Admin manually escalates to Level 2 --
        vm.prank(admin);
        circuitBreaker.setLevel(2);

        assertEq(
            uint8(circuitBreaker.level()),
            uint8(ICircuitBreaker.CircuitBreakerLevel.Stress),
            "Should be Stress level"
        );

        // -- Step 6: Admin escalates to Level 3 (Emergency) --
        vm.prank(admin);
        circuitBreaker.setLevel(3);

        assertEq(
            uint8(circuitBreaker.level()),
            uint8(ICircuitBreaker.CircuitBreakerLevel.Emergency),
            "Should be Emergency level"
        );

        // Level 3 does NOT auto-recover
        vm.warp(block.timestamp + 1 hours);
        assertEq(uint8(circuitBreaker.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Emergency));

        // -- Step 7: Admin resumes from Emergency --
        vm.prank(admin);
        circuitBreaker.resume();

        assertEq(
            uint8(circuitBreaker.level()),
            uint8(ICircuitBreaker.CircuitBreakerLevel.Inactive),
            "Should be Inactive after admin resume"
        );
    }

    // ================================================================
    // E2E Test 8: Multi-User Concurrent Operations
    // Multiple users borrowing, repaying, and checking invariants
    // ================================================================

    function test_e2e_multiUserConcurrentOperations() public {
        // -- Setup: Alice provides liquidity --
        vm.startPrank(alice);
        usdc.approve(address(vault), 500_000 * USDC_UNIT);
        vault.deposit(500_000 * USDC_UNIT, alice);
        vm.stopPrank();

        // -- Bob deposits collateral and borrows --
        vm.startPrank(bob);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 10 ether);
        usdc.approve(address(pool), type(uint256).max);
        pool.borrow(address(bridgedETH), 8_000 * USDC_UNIT, emptyUpdates);
        vm.stopPrank();

        // -- Dave deposits collateral and borrows --
        vm.startPrank(dave);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 5 ether);
        usdc.approve(address(pool), type(uint256).max);
        // 5 ETH * $2000 * 75% = $7,500 max
        pool.borrow(address(bridgedETH), 5_000 * USDC_UNIT, emptyUpdates);
        vm.stopPrank();

        // -- Verify combined state --
        assertEq(pool.getTotalBorrowed(), 13_000 * USDC_UNIT, "Total borrowed = 13k");
        assertEq(pool.getUserDebt(bob), 8_000 * USDC_UNIT);
        assertEq(pool.getUserDebt(dave), 5_000 * USDC_UNIT);

        // -- Time passes (60 days) --
        vm.warp(block.timestamp + 60 days);
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);
        stork.setPriceNow(ETH_VOL_FEED_ID, int192(int256(25e16)));

        // -- Bob repays partially --
        vm.prank(bob);
        pool.repay(4_000 * USDC_UNIT);

        uint256 bobDebtAfter = pool.getUserDebt(bob);
        // Debt should be > 4000 (had 8000, repaid 4000, but interest accrued)
        assertGt(bobDebtAfter, 4_000 * USDC_UNIT, "Bob should have interest on remaining");

        // -- Dave repays fully --
        vm.prank(dave);
        pool.repayFull();
        assertEq(pool.getUserDebt(dave), 0, "Dave debt cleared");

        // -- Dave withdraws collateral --
        vm.prank(dave);
        collateralManager.withdrawCollateral(address(bridgedETH), 5 ether);
        assertEq(bridgedETH.balanceOf(dave), 5 ether);

        // -- Bob repays rest and withdraws --
        vm.prank(bob);
        pool.repayFull();
        assertEq(pool.getUserDebt(bob), 0, "Bob debt cleared");
        // Total borrowed may have dust (<=1) from interest rounding
        assertLe(pool.getTotalBorrowed(), 1, "All debt cleared (rounding dust ok)");

        vm.prank(bob);
        collateralManager.withdrawCollateral(address(bridgedETH), 10 ether);
        assertEq(bridgedETH.balanceOf(bob), 10 ether);

        // -- Vault accounting invariant: totalAssets >= total deposited --
        assertGe(vault.totalAssets(), 500_000 * USDC_UNIT, "Vault should have interest income");
    }

    // ================================================================
    // E2E Test 9: ETHEscrow Timeout + Refund Flow
    // Deposit ETH -> Wait for timeout -> Refund
    // ================================================================

    function test_e2e_ethEscrowRefundAfterTimeout() public {
        address user = makeAddr("escrowUser");
        vm.deal(user, 2 ether);

        // -- Step 1: Deposit ETH --
        vm.prank(user);
        ethEscrow.deposit{value: 2 ether}();

        assertEq(user.balance, 0);

        // -- Step 2: Cannot refund before timeout --
        vm.prank(user);
        vm.expectRevert(IETHEscrow.RefundTooEarly.selector);
        ethEscrow.refund(0);

        // -- Step 3: Wait 24 hours --
        vm.warp(block.timestamp + 86401); // > 86400 REFUND_TIMEOUT

        // -- Step 4: Refund succeeds --
        vm.prank(user);
        ethEscrow.refund(0);

        assertEq(user.balance, 2 ether, "User gets ETH back");
        IETHEscrow.DepositInfo memory info = ethEscrow.getDeposit(0);
        assertEq(uint8(info.status), uint8(IETHEscrow.DepositStatus.Refunded));
    }

    // ================================================================
    // E2E Test 10: CCTP Bridge Multi-Chain Operations
    // Bridge USDC to Ethereum, Arbitrum, and Base
    // ================================================================

    function test_e2e_cctpBridgeMultiChain() public {
        // Fund the bridge contract with USDC
        usdc.mint(address(this), 10_000 * USDC_UNIT);
        usdc.approve(address(cctpBridge), type(uint256).max);

        bytes32 recipient = bytes32(uint256(uint160(bob)));

        // -- Bridge to Ethereum --
        cctpBridge.bridgeUSDC(1_000 * USDC_UNIT, 0, recipient);
        assertEq(messenger.lastDestinationDomain(), 0);
        assertEq(messenger.callCount(), 1);

        // -- Bridge to Arbitrum --
        cctpBridge.bridgeUSDC(2_000 * USDC_UNIT, 3, recipient);
        assertEq(messenger.lastDestinationDomain(), 3);
        assertEq(messenger.callCount(), 2);

        // -- Bridge to Base --
        cctpBridge.bridgeUSDC(3_000 * USDC_UNIT, 6, recipient);
        assertEq(messenger.lastDestinationDomain(), 6);
        assertEq(messenger.callCount(), 3);

        // -- Verify chain info --
        ICCTPBridge.ChainInfo[] memory chains = cctpBridge.getSupportedChains();
        assertEq(chains.length, 3, "Should support 3 chains");
    }

    // ================================================================
    // E2E Test 11: Full Protocol Stress Test
    // Many operations, time warps, price changes, liquidations -- all
    // invariants must hold throughout
    // ================================================================

    function test_e2e_protocolStressTest() public {
        // -- Setup: Alice provides massive liquidity --
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000_000 * USDC_UNIT);
        vault.deposit(1_000_000 * USDC_UNIT, alice);
        vm.stopPrank();

        // -- Phase 1: Multiple borrows --
        vm.startPrank(bob);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 10 ether);
        usdc.approve(address(pool), type(uint256).max);
        pool.borrow(address(bridgedETH), 5_000 * USDC_UNIT, emptyUpdates);
        vm.stopPrank();

        vm.startPrank(dave);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 5 ether);
        usdc.approve(address(pool), type(uint256).max);
        pool.borrow(address(bridgedETH), 3_000 * USDC_UNIT, emptyUpdates);
        vm.stopPrank();

        _assertProtocolInvariants();

        // -- Phase 2: Time passes -- interest accrues --
        vm.warp(block.timestamp + 30 days);
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);
        stork.setPriceNow(ETH_VOL_FEED_ID, int192(int256(25e16)));

        // Bob borrows more
        vm.prank(bob);
        pool.borrow(address(bridgedETH), 2_000 * USDC_UNIT, emptyUpdates);

        _assertProtocolInvariants();

        // -- Phase 3: Price volatility --
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(2200e18))); // ETH up to $2200
        _assertProtocolInvariants();

        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(1900e18))); // ETH down to $1900
        _assertProtocolInvariants();

        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE); // Back to $2000

        // -- Phase 4: Partial repayments --
        vm.warp(block.timestamp + 15 days);
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);
        stork.setPriceNow(ETH_VOL_FEED_ID, int192(int256(25e16)));

        vm.prank(dave);
        pool.repay(1_000 * USDC_UNIT);

        _assertProtocolInvariants();

        // -- Phase 5: Full cleanup --
        vm.prank(bob);
        pool.repayFull();
        vm.prank(dave);
        pool.repayFull();

        assertEq(pool.getTotalBorrowed(), 0, "All debt should be cleared");

        // Withdraw all collateral
        vm.prank(bob);
        collateralManager.withdrawCollateral(address(bridgedETH), 10 ether);
        vm.prank(dave);
        collateralManager.withdrawCollateral(address(bridgedETH), 5 ether);

        _assertProtocolInvariants();

        // Vault should have earned interest
        assertGt(vault.totalAssets(), 1_000_000 * USDC_UNIT, "Vault should profit from interest");
    }

    // ================================================================
    // E2E Test 12: BridgedETH Nonce Replay Protection
    // Verify nonce tracking prevents double-minting
    // ================================================================

    function test_e2e_bridgedETHNonceReplayProtection() public {
        // Mint with nonce 100
        vm.prank(relayer);
        bridgedETH.mint(alice, 1 ether, 100);

        assertEq(bridgedETH.balanceOf(alice), 1 ether);
        assertTrue(bridgedETH.isNonceProcessed(100));

        // Same nonce should revert
        vm.prank(relayer);
        vm.expectRevert();
        bridgedETH.mint(alice, 1 ether, 100);

        // Different nonce works
        vm.prank(relayer);
        bridgedETH.mint(alice, 2 ether, 101);

        assertEq(bridgedETH.balanceOf(alice), 3 ether);
    }

    // ================================================================
    // E2E Test 13: Admin Controls Across All Contracts
    // Verify role-based access control on every contract
    // ================================================================

    function test_e2e_adminControlsAcrossAllContracts() public {
        address rando = makeAddr("unauthorized");

        // -- LendingPool: non-admin cannot set dependencies --
        vm.startPrank(rando);

        vm.expectRevert();
        pool.setInterestRateModel(address(1));

        vm.expectRevert();
        pool.setCollateralManager(address(1));

        vm.expectRevert();
        pool.setVault(address(1));

        vm.stopPrank();

        // -- CollateralManager: non-admin cannot set lending pool --
        vm.prank(rando);
        vm.expectRevert();
        collateralManager.setLendingPool(address(1));

        // -- LiquidationEngine: non-admin cannot set dependencies --
        vm.prank(rando);
        vm.expectRevert();
        liquidationEngine.setLendingPool(address(1));

        // -- Vault: non-pool cannot lend --
        vm.prank(rando);
        vm.expectRevert();
        vault.lend(100);

        // -- CircuitBreaker: non-admin cannot resume --
        vm.prank(admin);
        circuitBreaker.setLevel(1);

        vm.prank(rando);
        vm.expectRevert();
        circuitBreaker.resume();

        // Admin can resume
        vm.prank(admin);
        circuitBreaker.resume();

        // -- InterestRateModel: non-admin cannot set params --
        vm.prank(rando);
        vm.expectRevert();
        rateModel.setParameters(0.8e18, 0.04e18, 0.75e18, 0.1e18);

        // -- RiskParameterEngine: non-admin cannot set base LTV --
        vm.prank(rando);
        vm.expectRevert();
        riskEngine.setBaseLTV(address(bridgedETH), 0.5e18);
    }

    // ================================================================
    // E2E Test 14: Share Price Accuracy Through Full Cycle
    // Deposit -> Lend -> Earn Interest -> Verify share price
    // ================================================================

    function test_e2e_sharePriceAccuracyThroughCycle() public {
        // -- Step 1: Alice deposits 100k USDC --
        vm.startPrank(alice);
        usdc.approve(address(vault), 100_000 * USDC_UNIT);
        vault.deposit(100_000 * USDC_UNIT, alice);
        vm.stopPrank();

        // Share price starts at 1:1
        assertEq(vault.convertToAssets(USDC_UNIT), USDC_UNIT, "Initial share price = 1.0");

        // -- Step 2: Bob borrows (creates loan income potential) --
        // 10 ETH * $2000 * 75% LTV = $15,000 max borrow
        vm.startPrank(bob);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 10 ether);
        usdc.approve(address(pool), type(uint256).max);
        pool.borrow(address(bridgedETH), 10_000 * USDC_UNIT, emptyUpdates);
        vm.stopPrank();

        // -- Step 3: Time passes -- interest accrues on the 50k loan --
        vm.warp(block.timestamp + 365 days);
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);
        stork.setPriceNow(ETH_VOL_FEED_ID, int192(int256(25e16)));

        // -- Step 4: Bob repays with interest --
        vm.prank(bob);
        pool.repayFull();

        // -- Step 5: Share price should now be > 1.0 (vault earned interest) --
        uint256 sharePrice = vault.convertToAssets(USDC_UNIT);
        assertGt(sharePrice, USDC_UNIT, "Share price should increase from interest income");

        // Total assets should exceed initial deposit
        assertGt(vault.totalAssets(), 100_000 * USDC_UNIT, "Vault should have grown from interest");
    }

    // ================================================================
    // E2E Test 15: Oracle Staleness Protection
    // Fresh oracle -> operations succeed -> Stale oracle -> operations
    // use safe fallback
    // ================================================================

    function test_e2e_oracleStalenessProtection() public {
        // -- Setup --
        vm.startPrank(alice);
        usdc.approve(address(vault), 500_000 * USDC_UNIT);
        vault.deposit(500_000 * USDC_UNIT, alice);
        vm.stopPrank();

        vm.startPrank(bob);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 10 ether);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();

        // -- Step 1: Fresh oracle -- borrow succeeds --
        vm.prank(bob);
        pool.borrow(address(bridgedETH), 5_000 * USDC_UNIT, emptyUpdates);
        assertEq(pool.getUserDebt(bob), 5_000 * USDC_UNIT);

        // -- Step 2: Warp past staleness threshold (3600s) without updating oracle --
        vm.warp(block.timestamp + 3601);

        // Oracle is now stale -- getETHPrice should return 0
        uint256 stalePrice = collateralManager.getETHPrice();
        assertEq(stalePrice, 0, "Stale oracle should return 0");

        // Collateral value should be 0 with stale price
        uint256 staleValue = collateralManager.getCollateralValueView(bob);
        assertEq(staleValue, 0, "Collateral value should be 0 with stale oracle");

        // -- Step 3: Refresh oracle -- everything works again --
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);
        stork.setPriceNow(ETH_VOL_FEED_ID, int192(int256(25e16)));

        uint256 freshPrice = collateralManager.getETHPrice();
        assertEq(freshPrice, uint256(uint192(ETH_PRICE)), "Fresh oracle should return price");

        // Bob can borrow again
        vm.prank(bob);
        pool.borrow(address(bridgedETH), 1_000 * USDC_UNIT, emptyUpdates);
        // Debt = original 5000 + tiny interest accrued during 3601s + new 1000
        uint256 debtAfterSecondBorrow = pool.getUserDebt(bob);
        assertGe(debtAfterSecondBorrow, 6_000 * USDC_UNIT, "Debt should be >= 6000 USDC");
        assertLe(debtAfterSecondBorrow, 6_100 * USDC_UNIT, "Debt should be reasonable");

        // Cleanup
        vm.prank(bob);
        pool.repayFull();
    }

    // ================================================================
    // E2E Test 16: Liquidation with Depth-Scaled Bonus
    // Deeper underwater = higher bonus for liquidator
    // ================================================================

    function test_e2e_liquidationDepthScaledBonus() public {
        // -- Setup --
        vm.startPrank(alice);
        usdc.approve(address(vault), 500_000 * USDC_UNIT);
        vault.deposit(500_000 * USDC_UNIT, alice);
        vm.stopPrank();

        vm.startPrank(bob);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 10 ether);
        usdc.approve(address(pool), type(uint256).max);
        pool.borrow(address(bridgedETH), 15_000 * USDC_UNIT, emptyUpdates); // Max LTV
        vm.stopPrank();

        // -- Moderate price drop: HF ~0.91 -> moderate bonus --
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(1700e18)));
        stork.setPriceNow(ETH_VOL_FEED_ID, int192(int256(25e16)));

        // Calculate HF manually: (10 * 1700 * 0.82) / 15000 = 0.929 ~ below 1
        uint256 bonus1 = liquidationEngine.calculateLiquidationBonus(0.93e18); // ~HF 0.93

        // -- Severe price drop: HF ~0.70 -> higher bonus --
        uint256 bonus2 = liquidationEngine.calculateLiquidationBonus(0.70e18);

        assertGt(bonus2, bonus1, "Deeper underwater should give higher bonus");

        // Actually liquidate
        vm.startPrank(charlie);
        usdc.approve(address(liquidationEngine), type(uint256).max);
        uint256 charlieETHBefore = bridgedETH.balanceOf(charlie);
        liquidationEngine.liquidate(bob, address(bridgedETH), 3_000 * USDC_UNIT, emptyUpdates);
        vm.stopPrank();

        uint256 ethReceived = bridgedETH.balanceOf(charlie) - charlieETHBefore;
        assertGt(ethReceived, 0, "Liquidator should receive ETH");
    }

    // ================================================================
    // E2E Test 17: Collateral Config Management
    // Add collateral type -> Verify config -> Update config
    // ================================================================

    function test_e2e_collateralConfigManagement() public {
        address fakeToken = makeAddr("fakeToken");
        bytes32 fakeFeedId = keccak256("FAKEUSD");

        // -- Add new collateral type --
        vm.prank(admin);
        collateralManager.addCollateralType(
            fakeToken,
            CollateralManager.CollateralConfig({
                baseLTV: 0.65e18,
                liquidationThreshold: 0.72e18,
                liquidationBonus: 0.04e18,
                priceFeedId: fakeFeedId,
                volatilityFeedId: bytes32(0),
                isActive: true
            })
        );

        // -- Verify config --
        CollateralManager.CollateralConfig memory config = collateralManager.getCollateralConfig(fakeToken);
        assertEq(config.baseLTV, 0.65e18);
        assertEq(config.liquidationThreshold, 0.72e18);
        assertEq(config.liquidationBonus, 0.04e18);
        assertTrue(config.isActive);
        assertEq(collateralManager.getPriceFeedId(fakeToken), fakeFeedId);

        // -- Verify supported tokens --
        address[] memory tokens = collateralManager.getSupportedCollateralTokens();
        assertEq(tokens.length, 1);
        assertEq(tokens[0], fakeToken);

        // -- Update config --
        vm.prank(admin);
        collateralManager.updateCollateralConfig(
            fakeToken,
            CollateralManager.CollateralConfig({
                baseLTV: 0.70e18,
                liquidationThreshold: 0.77e18,
                liquidationBonus: 0.05e18,
                priceFeedId: fakeFeedId,
                volatilityFeedId: bytes32(0),
                isActive: true
            })
        );

        CollateralManager.CollateralConfig memory updated = collateralManager.getCollateralConfig(fakeToken);
        assertEq(updated.baseLTV, 0.70e18);
    }

    // ================================================================
    // E2E Test 18: Supply Rate Dual-Yield Formula Verification
    // Verify the supply rate formula: (borrowRate * U * (1-RF)) + (usycYield * (1-U) * (1-SF))
    // ================================================================

    function test_e2e_supplyRateDualYieldFormula() public {
        uint256 borrowRate = 0.04e18; // 4%
        uint256 utilisation = 0.5e18; // 50%
        uint256 usycYield = 0.045e18; // 4.5% T-bill

        uint256 supplyRate = vault.getSupplyRate(borrowRate, utilisation, usycYield);

        // Manual calculation:
        // borrow component: 0.04 * 0.5 * (1 - 0.1) = 0.04 * 0.5 * 0.9 = 0.018 = 1.8%
        // usyc component: 0.045 * (1 - 0.5) * (1 - 0.05) = 0.045 * 0.5 * 0.95 = 0.021375 = 2.1375%
        // total: 1.8% + 2.1375% = 3.9375%
        uint256 expectedBorrowComp = (borrowRate * utilisation / WAD) * (WAD - 0.1e18) / WAD;
        uint256 expectedUSYCComp = (usycYield * (WAD - utilisation) / WAD) * (WAD - 0.05e18) / WAD;
        uint256 expected = expectedBorrowComp + expectedUSYCComp;

        assertApproxEqAbs(supplyRate, expected, 1, "Supply rate should match formula");
        assertGt(supplyRate, 0, "Supply rate should be positive");

        // At 0% utilisation, supply rate = pure USYC yield
        uint256 pureUSYCRate = vault.getSupplyRate(borrowRate, 0, usycYield);
        uint256 expectedPure = (usycYield * WAD / WAD) * (WAD - 0.05e18) / WAD;
        assertApproxEqAbs(pureUSYCRate, expectedPure, 1, "Should be pure USYC yield at 0% util");

        // At 100% utilisation, supply rate = pure borrow interest
        uint256 pureBorrowRate = vault.getSupplyRate(borrowRate, WAD, usycYield);
        uint256 expectedPureBorrow = (borrowRate * WAD / WAD) * (WAD - 0.1e18) / WAD;
        assertApproxEqAbs(pureBorrowRate, expectedPureBorrow, 1, "Should be pure borrow at 100% util");
    }

    // ================================================================
    // E2E Test 19: Interest Accrual Precision Over Time
    // Verify compound interest grows correctly over multiple periods
    // ================================================================

    function test_e2e_interestAccrualPrecisionOverTime() public {
        // -- Setup --
        vm.startPrank(alice);
        usdc.approve(address(vault), 500_000 * USDC_UNIT);
        vault.deposit(500_000 * USDC_UNIT, alice);
        vm.stopPrank();

        vm.startPrank(bob);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 10 ether);
        usdc.approve(address(pool), type(uint256).max);
        pool.borrow(address(bridgedETH), 10_000 * USDC_UNIT, emptyUpdates);
        vm.stopPrank();

        uint256 initialDebt = pool.getUserDebt(bob);
        assertEq(initialDebt, 10_000 * USDC_UNIT);

        // -- Accrue over 4 quarterly periods --
        for (uint256 i = 0; i < 4; i++) {
            vm.warp(block.timestamp + 90 days);
            stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);
            stork.setPriceNow(ETH_VOL_FEED_ID, int192(int256(25e16)));

            // Trigger accrual
            pool.accrueInterest();
        }

        uint256 debtAfterYear = pool.getUserDebt(bob);
        assertGt(debtAfterYear, initialDebt, "Debt should grow over time");

        // Interest should be reasonable (not zero, not astronomical)
        uint256 interestEarned = debtAfterYear - initialDebt;
        // At 2% utilisation with 4% slope1, borrow rate ~= 0.1%
        // Over 1 year on 10k, interest should be < 1000 USDC (sanity)
        assertLt(interestEarned, 1_000 * USDC_UNIT, "Interest should be within reasonable bounds");
        assertGt(interestEarned, 0, "Some interest should accrue");

        // Repay
        vm.prank(bob);
        pool.repayFull();
        assertEq(pool.getUserDebt(bob), 0);
    }

    // ================================================================
    // E2E Test 20: Health Factor Boundary -- Exact Threshold
    // Borrow right up to the boundary and verify health factor
    // ================================================================

    function test_e2e_healthFactorBoundary() public {
        // -- Setup --
        vm.startPrank(alice);
        usdc.approve(address(vault), 500_000 * USDC_UNIT);
        vault.deposit(500_000 * USDC_UNIT, alice);
        vm.stopPrank();

        vm.startPrank(bob);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 10 ether);
        usdc.approve(address(pool), type(uint256).max);

        // Borrow exactly at max LTV: 10 ETH * $2000 * 75% = $15,000
        pool.borrow(address(bridgedETH), 15_000 * USDC_UNIT, emptyUpdates);
        vm.stopPrank();

        // Health factor at max LTV:
        // HF = (collateral * liqThreshold) / debt
        // HF = (10 * 2000 * 0.82) / 15000 = 16400 / 15000 = 1.0933...
        // Should be > 1.0 (not liquidatable)
        assertFalse(liquidationEngine.isLiquidatable(bob), "Should not be liquidatable at max LTV");

        // Tiny price drop that pushes HF below 1.0
        // Need: (10 * P * 0.82) / 15000 < 1.0
        // P < 15000 / (10 * 0.82) = 1829.27
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(1820e18)));
        stork.setPriceNow(ETH_VOL_FEED_ID, int192(int256(25e16)));

        assertTrue(liquidationEngine.isLiquidatable(bob), "Should be liquidatable after price drop");

        // Recovery: price back up
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);

        assertFalse(liquidationEngine.isLiquidatable(bob), "Should recover when price recovers");

        // Cleanup
        vm.prank(bob);
        pool.repayFull();
    }

    // ================================================================
    // Internal Helpers
    // ================================================================

    /// @dev Assert core protocol invariants hold
    function _assertProtocolInvariants() internal view {
        // 1. Total borrowed <= vault total assets
        uint256 totalBorrowed = pool.getTotalBorrowed();
        uint256 totalAssets = vault.totalAssets();
        assertLe(totalBorrowed, totalAssets, "INVARIANT: borrowed > vault assets");

        // 2. Vault accounting: idle + lent <= totalAssets
        uint256 idle = usdc.balanceOf(address(vault));
        uint256 lent = vault.totalLent();
        assertLe(idle + lent, totalAssets, "INVARIANT: idle + lent > totalAssets");

        // 3. Effective LTV in valid range
        uint256 effectiveLTV = collateralManager.getEffectiveLTV();
        assertGe(effectiveLTV, 0.3e18, "INVARIANT: LTV < 30%");
        assertLe(effectiveLTV, 1e18, "INVARIANT: LTV > 100%");
    }
}

