// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {LiquidationEngine} from "../src/core/LiquidationEngine.sol";
import {LendingPool} from "../src/core/LendingPool.sol";
import {CollateralManager} from "../src/core/CollateralManager.sol";
import {ChariotVault} from "../src/core/ChariotVault.sol";
import {ChariotBase} from "../src/base/ChariotBase.sol";
import {InterestRateModel} from "../src/risk/InterestRateModel.sol";
import {ILiquidationEngine} from "../src/interfaces/ILiquidationEngine.sol";
import {ILendingPool} from "../src/interfaces/ILendingPool.sol";
import {ICollateralManager} from "../src/interfaces/ICollateralManager.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockStork} from "./mocks/MockStork.sol";
import {MockUSYCTeller} from "./mocks/MockUSYCTeller.sol";
import {BridgedETH} from "../src/bridge/BridgedETH.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StorkStructs} from "@stork-oracle/StorkStructs.sol";

contract LiquidationEngineTest is Test {
    LiquidationEngine public liquidationEngine;
    LendingPool public pool;
    CollateralManager public collateralManager;
    ChariotVault public vault;
    InterestRateModel public rateModel;
    MockERC20 public usdc;
    MockERC20 public usyc;
    MockStork public stork;
    MockUSYCTeller public teller;
    BridgedETH public bridgedETH;

    address public admin = makeAddr("admin");
    address public alice = makeAddr("alice"); // borrower
    address public bob = makeAddr("bob"); // liquidator
    address public relayer = makeAddr("relayer");

    uint256 constant USDC_UNIT = 1e6;
    uint256 constant WAD = 1e18;
    int192 constant ETH_PRICE = 2000e18; // $2000
    bytes32 constant ETHUSD_FEED_ID = 0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160;

    StorkStructs.TemporalNumericValueInput[] emptyUpdates;

    function setUp() public {
        // Deploy tokens
        usdc = new MockERC20("USD Coin", "USDC", 6);
        usyc = new MockERC20("US Yield Coin", "USYC", 6);
        stork = new MockStork();
        teller = new MockUSYCTeller(address(usdc), address(usyc), 1e18);
        bridgedETH = new BridgedETH(admin, relayer);

        // Deploy core contracts
        rateModel = new InterestRateModel();
        vault = new ChariotVault(address(usdc), address(usyc), address(teller), address(stork), admin);
        collateralManager = new CollateralManager(address(bridgedETH), address(stork), admin);
        pool = new LendingPool(address(usdc), address(stork), admin);
        liquidationEngine = new LiquidationEngine(address(usdc), address(stork), admin);

        // Wire dependencies
        vm.startPrank(admin);
        pool.setInterestRateModel(address(rateModel));
        pool.setCollateralManager(address(collateralManager));
        pool.setVault(address(vault));
        collateralManager.setLendingPool(address(pool));
        liquidationEngine.setLendingPool(address(pool));
        liquidationEngine.setCollateralManager(address(collateralManager));
        liquidationEngine.setVault(address(vault));

        // Grant roles
        vault.grantRole(vault.LENDING_POOL_ROLE(), address(pool));
        pool.grantRole(pool.LIQUIDATION_ENGINE_ROLE(), address(liquidationEngine));
        collateralManager.grantRole(collateralManager.LIQUIDATION_ENGINE_ROLE(), address(liquidationEngine));
        vm.stopPrank();

        // Set ETH price to $2000
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);

        // Fund vault with USDC (depositors)
        usdc.mint(address(this), 1_000_000 * USDC_UNIT);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(1_000_000 * USDC_UNIT, address(this));

        // Give alice 5 ETH collateral (= $10,000 at $2000/ETH)
        vm.prank(relayer);
        bridgedETH.mint(alice, 5 ether, 0);

        // Alice deposits collateral and borrows
        vm.startPrank(alice);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 5 ether);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();

        // Give alice USDC for repayments
        usdc.mint(alice, 100_000 * USDC_UNIT);

        // Give bob USDC for liquidation
        usdc.mint(bob, 500_000 * USDC_UNIT);
        vm.prank(bob);
        usdc.approve(address(liquidationEngine), type(uint256).max);
    }

    // ================================================================
    // Helper: Put alice into a liquidatable state
    // ================================================================

    function _makeAliceLiquidatable() internal {
        // Alice borrows max: $10,000 * 75% LTV = $7,500
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 7500 * USDC_UNIT, emptyUpdates);

        // Drop ETH price so HF < 1.0
        // HF = (collateral_value * 0.82) / debt
        // Need HF < 1.0: collateral_value * 0.82 < debt
        // 5 ETH * newPrice * 0.82 < $7500
        // newPrice < 7500 / (5 * 0.82) = $1829.27
        // Set price to $1800 -> HF = (5*1800*0.82)/7500 = 7380/7500 = 0.984
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(1800e18)));
    }

    /// @notice Helper to calculate the expected scaled bonus WAD for a given HF
    function _expectedBonusWad(uint256 healthFactor) internal view returns (uint256) {
        uint256 bonusBps = liquidationEngine.calculateLiquidationBonus(healthFactor);
        return bonusBps * 1e14;
    }

    // ================================================================
    // Core Liquidation Tests
    // ================================================================

    function test_liquidate_succeedsWhenHFBelowOne() public {
        _makeAliceLiquidatable();

        uint256 debtToRepay = 2000 * USDC_UNIT;
        uint256 bobUsdcBefore = usdc.balanceOf(bob);
        uint256 bobETHBefore = bridgedETH.balanceOf(bob);

        vm.prank(bob);
        liquidationEngine.liquidate(alice, address(bridgedETH), debtToRepay, emptyUpdates);

        // Bob should have less USDC (paid the debt)
        assertEq(usdc.balanceOf(bob), bobUsdcBefore - debtToRepay);

        // Bob should have received BridgedETH
        assertTrue(bridgedETH.balanceOf(bob) > bobETHBefore);

        // Alice's debt should be reduced
        assertTrue(pool.getUserDebt(alice) < 7500 * USDC_UNIT);
    }

    function test_liquidate_correctCollateralSeizedWithScaledBonus() public {
        _makeAliceLiquidatable();

        // At $1800/ETH, HF = 0.984e18
        // Scaled bonus: 500 + min(500, (0.016e18 * 50 / 1e16)) = 500 + 80 = 580 BPS = 5.8%
        uint256 debtToRepay = 2000 * USDC_UNIT;
        uint256 hf = 984e15; // 0.984e18
        uint256 bonusWad = _expectedBonusWad(hf);
        uint256 expectedSeizure =
            liquidationEngine.calculateSeizableCollateral(uint256(2000e18), uint256(1800e18), bonusWad);

        uint256 bobETHBefore = bridgedETH.balanceOf(bob);

        vm.prank(bob);
        liquidationEngine.liquidate(alice, address(bridgedETH), debtToRepay, emptyUpdates);

        uint256 actualSeizure = bridgedETH.balanceOf(bob) - bobETHBefore;
        assertEq(actualSeizure, expectedSeizure);
    }

    function test_liquidate_reducesDebtCorrectly() public {
        _makeAliceLiquidatable();

        uint256 debtBefore = pool.getUserDebt(alice);
        uint256 debtToRepay = 2000 * USDC_UNIT;

        vm.prank(bob);
        liquidationEngine.liquidate(alice, address(bridgedETH), debtToRepay, emptyUpdates);

        uint256 debtAfter = pool.getUserDebt(alice);
        assertEq(debtBefore - debtAfter, debtToRepay);
    }

    function test_liquidate_usesScaledBonusNotStatic() public {
        _makeAliceLiquidatable();

        uint256 debtToRepay = 1000 * USDC_UNIT;
        // At $1800: HF = 0.984, scaled bonus = 580 BPS (5.8%)
        // base collateral = 1000/1800 = 0.5556 ETH
        // With 5.8% bonus = 0.5556 * 1.058 = 0.5878 ETH
        uint256 bonusWad = 580 * 1e14; // 5.8%
        uint256 baseCollateral = (uint256(1000e18) * WAD) / uint256(1800e18);
        uint256 expectedWithBonus = (baseCollateral * (WAD + bonusWad)) / WAD;

        uint256 bobETHBefore = bridgedETH.balanceOf(bob);

        vm.prank(bob);
        liquidationEngine.liquidate(alice, address(bridgedETH), debtToRepay, emptyUpdates);

        uint256 seized = bridgedETH.balanceOf(bob) - bobETHBefore;
        assertEq(seized, expectedWithBonus);
    }

    // ================================================================
    // Scaled Liquidation Bonus Calculation Tests (AC: 1, 2, 3, 4, 5)
    // ================================================================

    /// @notice AC2: HF = 0.99 -> bonus = 5% base + 0.5% depth = 5.5% (550 BPS)
    function test_calculateLiquidationBonus_HF099() public view {
        uint256 bonusBps = liquidationEngine.calculateLiquidationBonus(0.99e18);
        // depthBps = (0.01e18 * 50) / 1e16 = 50
        // total = 500 + 50 = 550
        assertEq(bonusBps, 550);
    }

    /// @notice AC3: HF = 0.95 -> bonus = 5% base + 2.5% depth = 7.5% (750 BPS)
    function test_calculateLiquidationBonus_HF095() public view {
        uint256 bonusBps = liquidationEngine.calculateLiquidationBonus(0.95e18);
        // depthBps = (0.05e18 * 50) / 1e16 = 250
        // total = 500 + 250 = 750
        assertEq(bonusBps, 750);
    }

    /// @notice AC4: HF = 0.85 -> bonus = 5% base + 5% depth (capped) = 10% (1000 BPS)
    function test_calculateLiquidationBonus_HF085() public view {
        uint256 bonusBps = liquidationEngine.calculateLiquidationBonus(0.85e18);
        // depthBps = (0.15e18 * 50) / 1e16 = 750, capped at 500
        // total = 500 + 500 = 1000
        assertEq(bonusBps, 1000);
    }

    /// @notice HF = 0.50 (deeply underwater) -> bonus capped at 10% (1000 BPS)
    function test_calculateLiquidationBonus_HF050_capped() public view {
        uint256 bonusBps = liquidationEngine.calculateLiquidationBonus(0.5e18);
        // depthBps = (0.50e18 * 50) / 1e16 = 2500, capped at 500
        // total = 500 + 500 = 1000
        assertEq(bonusBps, 1000);
    }

    /// @notice AC5: HF = 1.0 -> reverts (position is healthy)
    function test_calculateLiquidationBonus_revertsAtHF100() public {
        vm.expectRevert(ILiquidationEngine.PositionNotLiquidatable.selector);
        liquidationEngine.calculateLiquidationBonus(1e18);
    }

    /// @notice AC5: HF = 1.5 -> reverts (position is healthy)
    function test_calculateLiquidationBonus_revertsAtHF150() public {
        vm.expectRevert(ILiquidationEngine.PositionNotLiquidatable.selector);
        liquidationEngine.calculateLiquidationBonus(1.5e18);
    }

    // ================================================================
    // Admin Configuration Tests (AC: 6)
    // ================================================================

    function test_admin_canUpdateBaseBonusBps() public {
        vm.prank(admin);
        liquidationEngine.setBaseBonusBps(300);
        assertEq(liquidationEngine.baseBonusBps(), 300);
    }

    function test_admin_canUpdateMaxDepthBonusBps() public {
        vm.prank(admin);
        liquidationEngine.setMaxDepthBonusBps(700);
        assertEq(liquidationEngine.maxDepthBonusBps(), 700);
    }

    function test_admin_canUpdateDepthScalingFactor() public {
        vm.prank(admin);
        liquidationEngine.setDepthScalingFactor(100);
        assertEq(liquidationEngine.depthScalingFactor(), 100);
    }

    function test_admin_cannotSetCombinedBonusAbove20Percent() public {
        // base=500, try to set maxDepth=1600 -> 500+1600=2100 > 2000
        vm.prank(admin);
        vm.expectRevert(ILiquidationEngine.InvalidBonusParams.selector);
        liquidationEngine.setMaxDepthBonusBps(1600);

        // Set base to 1500 first
        vm.prank(admin);
        liquidationEngine.setBaseBonusBps(1500);

        // Try to set maxDepth=600 -> 1500+600=2100 > 2000
        vm.prank(admin);
        vm.expectRevert(ILiquidationEngine.InvalidBonusParams.selector);
        liquidationEngine.setMaxDepthBonusBps(600);
    }

    function test_admin_canSetCombinedBonusExactly20Percent() public {
        vm.prank(admin);
        liquidationEngine.setBaseBonusBps(1000);

        vm.prank(admin);
        liquidationEngine.setMaxDepthBonusBps(1000);

        assertEq(liquidationEngine.baseBonusBps(), 1000);
        assertEq(liquidationEngine.maxDepthBonusBps(), 1000);
    }

    function test_admin_emitsLiquidationBonusParamsUpdated() public {
        vm.expectEmit(false, false, false, true);
        emit ILiquidationEngine.LiquidationBonusParamsUpdated(300, 500, 50);

        vm.prank(admin);
        liquidationEngine.setBaseBonusBps(300);
    }

    function test_nonAdmin_cannotUpdateBonusParams() public {
        vm.prank(bob);
        vm.expectRevert();
        liquidationEngine.setBaseBonusBps(300);
    }

    // ================================================================
    // Liquidation Flow Uses Scaled Bonus (AC: 1)
    // ================================================================

    function test_liquidate_bonusIncreasesWithDeeperUnderwaterPosition() public {
        // Alice borrows max
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 7500 * USDC_UNIT, emptyUpdates);

        // Case 1: Barely liquidatable at $1800 -> HF ~0.984
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(1800e18)));

        uint256 bobETHBefore = bridgedETH.balanceOf(bob);
        vm.prank(bob);
        liquidationEngine.liquidate(alice, address(bridgedETH), 1000 * USDC_UNIT, emptyUpdates);
        uint256 seized1 = bridgedETH.balanceOf(bob) - bobETHBefore;

        // Case 2: Deeper underwater at $1500 -> HF ~0.82
        // Need new borrower (charlie) for clean test
        address charlie = makeAddr("charlie");
        vm.prank(relayer);
        bridgedETH.mint(charlie, 5 ether, 1);
        vm.startPrank(charlie);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 5 ether);
        vm.stopPrank();

        // Reset price for borrowing
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(2000e18)));
        vm.prank(charlie);
        pool.borrow(address(bridgedETH), 7500 * USDC_UNIT, emptyUpdates);

        // Drop to $1500 for deeper underwater
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(1500e18)));

        address carol = makeAddr("carol");
        usdc.mint(carol, 500_000 * USDC_UNIT);
        vm.prank(carol);
        usdc.approve(address(liquidationEngine), type(uint256).max);

        uint256 carolETHBefore = bridgedETH.balanceOf(carol);
        vm.prank(carol);
        liquidationEngine.liquidate(charlie, address(bridgedETH), 1000 * USDC_UNIT, emptyUpdates);
        uint256 seized2 = bridgedETH.balanceOf(carol) - carolETHBefore;

        // Deeper position gets MORE collateral per dollar of debt (higher bonus)
        // seized2 normalized by price should show higher bonus than seized1
        // At $1800: seized1 / (1000/1800) = bonus factor
        // At $1500: seized2 / (1000/1500) = bonus factor
        uint256 bonusFactor1 = (seized1 * uint256(1800e18)) / (uint256(1000e18));
        uint256 bonusFactor2 = (seized2 * uint256(1500e18)) / (uint256(1000e18));
        assertTrue(bonusFactor2 > bonusFactor1, "Deeper position should get higher bonus");
    }

    // ================================================================
    // Revert Tests
    // ================================================================

    function test_liquidate_revertsWhenHFAboveOne() public {
        // Alice borrows only $3000 -- HF is well above 1.0
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 3000 * USDC_UNIT, emptyUpdates);

        vm.prank(bob);
        vm.expectRevert(ILiquidationEngine.PositionNotLiquidatable.selector);
        liquidationEngine.liquidate(alice, address(bridgedETH), 1000 * USDC_UNIT, emptyUpdates);
    }

    function test_liquidate_revertsOnSelfLiquidation() public {
        _makeAliceLiquidatable();

        vm.prank(alice);
        usdc.approve(address(liquidationEngine), type(uint256).max);

        vm.prank(alice);
        vm.expectRevert(ILiquidationEngine.SelfLiquidation.selector);
        liquidationEngine.liquidate(alice, address(bridgedETH), 1000 * USDC_UNIT, emptyUpdates);
    }

    function test_liquidate_revertsOnZeroAmount() public {
        _makeAliceLiquidatable();

        vm.prank(bob);
        vm.expectRevert(ChariotBase.ZeroAmount.selector);
        liquidationEngine.liquidate(alice, address(bridgedETH), 0, emptyUpdates);
    }

    // ================================================================
    // Partial Liquidation / Max Ratio Tests
    // ================================================================

    function test_liquidate_revertsExceedsMaxLiquidation() public {
        _makeAliceLiquidatable();

        // Max is 50% of debt = $3750
        // Try to repay $4000
        vm.prank(bob);
        vm.expectRevert(ILiquidationEngine.ExceedsMaxLiquidation.selector);
        liquidationEngine.liquidate(alice, address(bridgedETH), 4000 * USDC_UNIT, emptyUpdates);
    }

    function test_liquidate_succeedsAtMaxRatio() public {
        _makeAliceLiquidatable();

        // Max is 50% of debt = $3750
        vm.prank(bob);
        liquidationEngine.liquidate(alice, address(bridgedETH), 3750 * USDC_UNIT, emptyUpdates);

        // Alice still has remaining debt
        assertTrue(pool.getUserDebt(alice) > 0);
    }

    // ================================================================
    // Liquidation Threshold Tests
    // ================================================================

    function test_getLiquidationThreshold_returns82Percent() public view {
        // 75% LTV + 7% buffer = 82%
        uint256 threshold = liquidationEngine.getLiquidationThreshold(address(bridgedETH));
        assertEq(threshold, 82e16);
    }

    function test_getLiquidationBonus_returnsBaseBonusInWad() public view {
        // Base bonus = 500 BPS = 5e16 WAD
        uint256 bonus = liquidationEngine.getLiquidationBonus(address(bridgedETH));
        assertEq(bonus, 5e16);
    }

    // ================================================================
    // Oracle Integration Tests
    // ================================================================

    function test_liquidate_usesUpdatedOraclePrice() public {
        // Alice borrows at $2000
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 7500 * USDC_UNIT, emptyUpdates);

        // Price drops to $1800 -- but set directly (simulating stale on-chain)
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(1800e18)));

        // Liquidation should succeed with the lower price
        vm.prank(bob);
        liquidationEngine.liquidate(alice, address(bridgedETH), 2000 * USDC_UNIT, emptyUpdates);

        assertTrue(pool.getUserDebt(alice) < 7500 * USDC_UNIT);
    }

    function test_liquidate_revertsWithStalePrice() public {
        // Alice borrows at $2000
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 7500 * USDC_UNIT, emptyUpdates);

        // Set stale price (timestamp very old) and drop price
        stork.setPrice(ETHUSD_FEED_ID, int192(int256(1800e18)), uint64(1)); // timestamp 1ns = stale

        // Warp to make it stale
        vm.warp(block.timestamp + 7200);

        vm.prank(bob);
        vm.expectRevert(ILiquidationEngine.StalePriceData.selector);
        liquidationEngine.liquidate(alice, address(bridgedETH), 2000 * USDC_UNIT, emptyUpdates);
    }

    // ================================================================
    // Event Emission Tests
    // ================================================================

    function test_liquidate_emitsPositionLiquidatedWithScaledBonus() public {
        _makeAliceLiquidatable();

        uint256 debtToRepay = 2000 * USDC_UNIT;
        // HF = 0.984e18 -> bonusBps = 580 -> bonusWad = 580 * 1e14 = 5.8e16
        uint256 bonusWad = _expectedBonusWad(984e15);
        uint256 expectedSeizure =
            liquidationEngine.calculateSeizableCollateral(uint256(2000e18), uint256(1800e18), bonusWad);

        vm.expectEmit(true, true, true, true);
        emit ILiquidationEngine.PositionLiquidated(
            alice, bob, address(bridgedETH), debtToRepay, expectedSeizure, bonusWad
        );

        vm.prank(bob);
        liquidationEngine.liquidate(alice, address(bridgedETH), debtToRepay, emptyUpdates);
    }

    // ================================================================
    // Seizure Math Tests
    // ================================================================

    function test_calculateSeizableCollateral_basicMath() public view {
        // $1000 / $2000 * 1.05 = 0.525 ETH
        uint256 result = liquidationEngine.calculateSeizableCollateral(1000e18, 2000e18, 5e16);
        assertEq(result, 0.525e18);
    }

    function test_calculateSeizableCollateral_noBonus() public view {
        // $1000 / $2000 * 1.0 = 0.5 ETH
        uint256 result = liquidationEngine.calculateSeizableCollateral(1000e18, 2000e18, 0);
        assertEq(result, 0.5e18);
    }

    function test_calculateSeizableCollateral_highBonus() public view {
        // $1000 / $2000 * 1.50 = 0.75 ETH
        uint256 result = liquidationEngine.calculateSeizableCollateral(1000e18, 2000e18, 50e16);
        assertEq(result, 0.75e18);
    }

    // ================================================================
    // isLiquidatable View Tests
    // ================================================================

    function test_isLiquidatable_falseWhenHealthy() public {
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 3000 * USDC_UNIT, emptyUpdates);

        assertFalse(liquidationEngine.isLiquidatable(alice));
    }

    function test_isLiquidatable_trueWhenUndercollateralized() public {
        _makeAliceLiquidatable();
        assertTrue(liquidationEngine.isLiquidatable(alice));
    }

    function test_isLiquidatable_falseWhenNoDebt() public view {
        assertFalse(liquidationEngine.isLiquidatable(alice));
    }

    // ================================================================
    // Liquidator Receives Correct BridgedETH
    // ================================================================

    function test_liquidate_liquidatorReceivesBridgedETH() public {
        _makeAliceLiquidatable();

        assertEq(bridgedETH.balanceOf(bob), 0);

        vm.prank(bob);
        liquidationEngine.liquidate(alice, address(bridgedETH), 2000 * USDC_UNIT, emptyUpdates);

        assertTrue(bridgedETH.balanceOf(bob) > 0);
    }

    // ================================================================
    // Gas Usage Test
    // ================================================================

    function test_liquidate_gasWithinLimits() public {
        _makeAliceLiquidatable();

        uint256 gasBefore = gasleft();
        vm.prank(bob);
        liquidationEngine.liquidate(alice, address(bridgedETH), 2000 * USDC_UNIT, emptyUpdates);
        uint256 gasUsed = gasBefore - gasleft();

        // Should complete in under 500k gas (well within block limits)
        assertTrue(gasUsed < 500_000, "Gas usage too high for liquidation");
    }

    // ================================================================
    // Edge Case: Insufficient Collateral for Seizure
    // ================================================================

    function test_liquidate_revertsInsufficientCollateralForSeizure() public {
        // Alice borrows max
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 7500 * USDC_UNIT, emptyUpdates);

        // Drop price to $200 -- Alice has 5 ETH = $1000, debt = $7500
        // Max repayable = 50% * $7500 = $3750
        // Seizure = ($3750 / $200) * bonus > 5 ETH
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(200e18)));

        vm.prank(bob);
        vm.expectRevert(ILiquidationEngine.InsufficientCollateralForSeizure.selector);
        liquidationEngine.liquidate(alice, address(bridgedETH), 3750 * USDC_UNIT, emptyUpdates);
    }

    // ================================================================
    // Edge Case: isLiquidatable with stale oracle returns false
    // ================================================================

    function test_isLiquidatable_falseWhenOracleStale() public {
        _makeAliceLiquidatable();

        // Make oracle stale
        stork.setPrice(ETHUSD_FEED_ID, int192(int256(1800e18)), uint64(1));
        vm.warp(block.timestamp + 7200);

        // Should return false (cannot determine) rather than true
        assertFalse(liquidationEngine.isLiquidatable(alice));
    }

    // ================================================================
    // Fuzz Tests
    // ================================================================

    function testFuzz_calculateSeizableCollateral_noOverflow(uint256 debt, uint256 price) public view {
        // Realistic bounds: debt in WAD ($1 to $1M), price in WAD ($100 to $100K)
        debt = bound(debt, 1e18, 1_000_000e18);
        price = bound(price, 100e18, 100_000e18);

        uint256 result = liquidationEngine.calculateSeizableCollateral(debt, price, 5e16);
        assertTrue(result > 0);
        // Seizure should always be >= debt/price (with bonus)
        uint256 baseResult = (debt * WAD) / price;
        assertTrue(result >= baseResult);
    }

    /// @notice Fuzz: random HF values produce valid bonuses within [baseBps, baseBps + maxDepthBps]
    function testFuzz_calculateLiquidationBonus_validRange(uint256 healthFactor) public view {
        // HF must be in (0, 1e18) exclusive for valid liquidation
        healthFactor = bound(healthFactor, 1, WAD - 1);

        uint256 bonusBps = liquidationEngine.calculateLiquidationBonus(healthFactor);
        uint256 baseBps = liquidationEngine.baseBonusBps();
        uint256 maxDepthBps = liquidationEngine.maxDepthBonusBps();

        assertTrue(bonusBps >= baseBps, "Bonus must be >= base");
        assertTrue(bonusBps <= baseBps + maxDepthBps, "Bonus must be <= base + maxDepth");
    }
}
