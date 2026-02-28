// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {RiskParameterEngine} from "../src/risk/RiskParameterEngine.sol";
import {IRiskParameterEngine} from "../src/interfaces/IRiskParameterEngine.sol";
import {MockStork} from "./mocks/MockStork.sol";

contract RiskParameterEngineTest is Test {
    RiskParameterEngine public engine;
    MockStork public mockStork;

    address constant ADMIN = address(0xAD);
    address constant BRIDGED_ETH = address(0xBE);
    address constant NON_ADMIN = address(0x1234);
    bytes32 constant ETHUSD_VGK_FEED_ID = keccak256("ETHUSD_VGK");

    uint256 constant WAD = 1e18;
    uint256 constant BASE_LTV = 75e16; // 75%
    uint256 constant K_LTV = 50e16; // 0.5
    uint256 constant BASELINE_VOL = 25e16; // 25%
    uint256 constant MIN_LTV_FLOOR = 30e16; // 30%
    uint256 constant LIQ_BUFFER = 7e16; // 7%

    function setUp() public {
        mockStork = new MockStork();
        engine = new RiskParameterEngine(address(mockStork), ADMIN);

        // Configure base LTV for BridgedETH
        vm.prank(ADMIN);
        engine.setBaseLTV(BRIDGED_ETH, BASE_LTV);
    }

    /// @dev Helper: configure volatility feed and set a volatility value
    function _setupVolatilityFeed(uint256 volatilityWad) internal {
        vm.prank(ADMIN);
        engine.setVolatilityFeedId(BRIDGED_ETH, ETHUSD_VGK_FEED_ID);
        mockStork.setPriceNow(ETHUSD_VGK_FEED_ID, int192(uint192(volatilityWad)));
    }

    // ================================================================
    // Effective LTV Tests (AC: 1-5)
    // ================================================================

    /// @notice AC5: calm markets (vol <= baseline) -- LTV remains at base 75%
    function test_effectiveLTV_atBaselineVolatility() public {
        _setupVolatilityFeed(25e16); // exactly 25%
        uint256 ltv = engine.getEffectiveLTV(BRIDGED_ETH);
        assertEq(ltv, 75e16, "LTV at baseline (25%) should be 75%");
    }

    /// @notice AC2: elevated vol 35% -- LTV = 75% - (0.5 * 10%) = 70%
    function test_effectiveLTV_at35PercentVol() public {
        _setupVolatilityFeed(35e16);
        uint256 ltv = engine.getEffectiveLTV(BRIDGED_ETH);
        assertEq(ltv, 70e16, "LTV at 35% vol should be 70%");
    }

    /// @notice AC3: stress vol 50% -- LTV = 75% - (0.5 * 25%) = 62.5%
    function test_effectiveLTV_at50PercentVol() public {
        _setupVolatilityFeed(50e16);
        uint256 ltv = engine.getEffectiveLTV(BRIDGED_ETH);
        assertEq(ltv, 625e15, "LTV at 50% vol should be 62.5%");
    }

    /// @notice AC5: below baseline (20%) -- LTV remains at base 75%
    function test_effectiveLTV_belowBaseline() public {
        _setupVolatilityFeed(20e16);
        uint256 ltv = engine.getEffectiveLTV(BRIDGED_ETH);
        assertEq(ltv, 75e16, "LTV below baseline should be 75%");
    }

    /// @notice AC4: extreme volatility (115%+) -- floor enforced at 30%
    function test_effectiveLTV_floorEnforced() public {
        // 75% - (0.5 * (115% - 25%)) = 75% - 45% = 30% (hits floor)
        _setupVolatilityFeed(115e16);
        uint256 ltv = engine.getEffectiveLTV(BRIDGED_ETH);
        assertEq(ltv, 30e16, "LTV at extreme vol should be floored at 30%");
    }

    /// @notice AC4: deeper extreme volatility (150%) -- still at floor
    function test_effectiveLTV_deepExtreme() public {
        // 75% - (0.5 * (150% - 25%)) = 75% - 62.5% = 12.5% -> floor 30%
        _setupVolatilityFeed(150e16);
        uint256 ltv = engine.getEffectiveLTV(BRIDGED_ETH);
        assertEq(ltv, 30e16, "LTV at 150% vol should be floored at 30%");
    }

    /// @notice AC1: fallback to baseLTV when no volatility feed configured
    function test_effectiveLTV_noFeedConfigured() public view {
        // No setVolatilityFeedId called -- feed is bytes32(0)
        uint256 ltv = engine.getEffectiveLTV(BRIDGED_ETH);
        assertEq(ltv, 75e16, "LTV without feed should be base 75%");
    }

    /// @notice Vol = 90% -- LTV = 75% - (0.5 * 65%) = 75% - 32.5% = 42.5%
    function test_effectiveLTV_at90PercentVol() public {
        _setupVolatilityFeed(90e16);
        uint256 ltv = engine.getEffectiveLTV(BRIDGED_ETH);
        assertEq(ltv, 425e15, "LTV at 90% vol should be 42.5%");
    }

    // ================================================================
    // Liquidation Threshold Tests (AC: 6)
    // ================================================================

    /// @notice AC6: threshold at baseline = 75% + 7% = 82%
    function test_liquidationThreshold_atBaseline() public {
        _setupVolatilityFeed(25e16);
        uint256 threshold = engine.getLiquidationThreshold(BRIDGED_ETH);
        assertEq(threshold, 82e16, "Threshold at baseline should be 82%");
    }

    /// @notice AC6: threshold at 35% vol = 70% + 7% = 77%
    function test_liquidationThreshold_at35PercentVol() public {
        _setupVolatilityFeed(35e16);
        uint256 threshold = engine.getLiquidationThreshold(BRIDGED_ETH);
        assertEq(threshold, 77e16, "Threshold at 35% vol should be 77%");
    }

    /// @notice AC6: threshold at floor = 30% + 7% = 37%
    function test_liquidationThreshold_atFloor() public {
        _setupVolatilityFeed(115e16);
        uint256 threshold = engine.getLiquidationThreshold(BRIDGED_ETH);
        assertEq(threshold, 37e16, "Threshold at floor should be 37%");
    }

    /// @notice AC6: threshold always = effectiveLTV + 7%
    function test_liquidationThreshold_alwaysEffectivePlusBuffer() public {
        _setupVolatilityFeed(50e16);
        uint256 ltv = engine.getEffectiveLTV(BRIDGED_ETH);
        uint256 threshold = engine.getLiquidationThreshold(BRIDGED_ETH);
        assertEq(threshold, ltv + LIQ_BUFFER, "Threshold should always be LTV + 7%");
    }

    // ================================================================
    // getCurrentVolatility Tests
    // ================================================================

    function test_getCurrentVolatility_returnsOracleValue() public {
        _setupVolatilityFeed(35e16);
        uint256 vol = engine.getCurrentVolatility(BRIDGED_ETH);
        assertEq(vol, 35e16, "Should return oracle volatility");
    }

    function test_getCurrentVolatility_zeroWhenNoFeed() public view {
        uint256 vol = engine.getCurrentVolatility(BRIDGED_ETH);
        assertEq(vol, 0, "Should return 0 when no feed configured");
    }

    // ================================================================
    // getVolatilityAdjustment Tests
    // ================================================================

    function test_getVolatilityAdjustment_at35Percent() public {
        _setupVolatilityFeed(35e16);
        uint256 adj = engine.getVolatilityAdjustment(BRIDGED_ETH);
        // 0.5 * 10% = 5%
        assertEq(adj, 5e16, "Adjustment at 35% vol should be 5%");
    }

    function test_getVolatilityAdjustment_belowBaseline() public {
        _setupVolatilityFeed(20e16);
        uint256 adj = engine.getVolatilityAdjustment(BRIDGED_ETH);
        assertEq(adj, 0, "Adjustment below baseline should be 0");
    }

    function test_getVolatilityAdjustment_noFeed() public view {
        uint256 adj = engine.getVolatilityAdjustment(BRIDGED_ETH);
        assertEq(adj, 0, "Adjustment without feed should be 0");
    }

    // ================================================================
    // getRiskParameters Tests (AC: 1-6)
    // ================================================================

    function test_getRiskParameters_allValues() public {
        _setupVolatilityFeed(35e16);
        (uint256 effectiveLTV, uint256 liqThreshold, uint256 currentVol) = engine.getRiskParameters(BRIDGED_ETH);
        assertEq(effectiveLTV, 70e16, "Effective LTV should be 70%");
        assertEq(liqThreshold, 77e16, "Liq threshold should be 77%");
        assertEq(currentVol, 35e16, "Current vol should be 35%");
    }

    function test_getRiskParameters_atBaseline() public {
        _setupVolatilityFeed(25e16);
        (uint256 effectiveLTV, uint256 liqThreshold, uint256 currentVol) = engine.getRiskParameters(BRIDGED_ETH);
        assertEq(effectiveLTV, 75e16, "Effective LTV should be 75%");
        assertEq(liqThreshold, 82e16, "Liq threshold should be 82%");
        assertEq(currentVol, 25e16, "Current vol should be 25%");
    }

    // ================================================================
    // Admin Access Control Tests
    // ================================================================

    function test_setVolatilityFeedId_requiresAdmin() public {
        vm.prank(NON_ADMIN);
        vm.expectRevert();
        engine.setVolatilityFeedId(BRIDGED_ETH, ETHUSD_VGK_FEED_ID);
    }

    function test_setVolatilityFeedId_succeeds() public {
        vm.prank(ADMIN);
        engine.setVolatilityFeedId(BRIDGED_ETH, ETHUSD_VGK_FEED_ID);
        assertEq(engine.getVolatilityFeedId(BRIDGED_ETH), ETHUSD_VGK_FEED_ID);
    }

    function test_setVolatilityFeedId_emitsEvent() public {
        vm.prank(ADMIN);
        vm.expectEmit(true, false, false, true);
        emit IRiskParameterEngine.VolatilityFeedConfigured(BRIDGED_ETH, ETHUSD_VGK_FEED_ID);
        engine.setVolatilityFeedId(BRIDGED_ETH, ETHUSD_VGK_FEED_ID);
    }

    function test_setVolatilityFeedId_revertsZeroAddress() public {
        vm.prank(ADMIN);
        vm.expectRevert();
        engine.setVolatilityFeedId(address(0), ETHUSD_VGK_FEED_ID);
    }

    function test_setBaseLTV_requiresAdmin() public {
        vm.prank(NON_ADMIN);
        vm.expectRevert();
        engine.setBaseLTV(BRIDGED_ETH, 75e16);
    }

    function test_setBaseLTV_succeeds() public {
        vm.prank(ADMIN);
        engine.setBaseLTV(BRIDGED_ETH, 65e16);
        assertEq(engine.getBaseLTV(BRIDGED_ETH), 65e16);
    }

    // ================================================================
    // Error Cases
    // ================================================================

    function test_getEffectiveLTV_revertsForUnconfiguredToken() public {
        vm.expectRevert(IRiskParameterEngine.CollateralNotSupported.selector);
        engine.getEffectiveLTV(address(0x9999));
    }

    /// @notice setBaseLTV with 0 or > WAD should revert with InvalidBaseLTV
    function test_setBaseLTV_revertsForZeroLTV() public {
        vm.prank(ADMIN);
        vm.expectRevert(IRiskParameterEngine.InvalidBaseLTV.selector);
        engine.setBaseLTV(BRIDGED_ETH, 0);
    }

    function test_setBaseLTV_revertsForLTVAboveWAD() public {
        vm.prank(ADMIN);
        vm.expectRevert(IRiskParameterEngine.InvalidBaseLTV.selector);
        engine.setBaseLTV(BRIDGED_ETH, WAD + 1);
    }

    /// @notice Negative volatility from oracle should revert with InvalidVolatilityValue
    function test_readVolatility_revertsOnNegativeValue() public {
        vm.prank(ADMIN);
        engine.setVolatilityFeedId(BRIDGED_ETH, ETHUSD_VGK_FEED_ID);
        mockStork.setPriceNow(ETHUSD_VGK_FEED_ID, int192(-1));
        vm.expectRevert(IRiskParameterEngine.InvalidVolatilityValue.selector);
        engine.getEffectiveLTV(BRIDGED_ETH);
    }

    /// @notice Stale volatility data should return base LTV (fallback to 0 vol)
    function test_readVolatility_staleDataFallsBackToBaseLTV() public {
        // Warp to a realistic block timestamp to avoid underflow
        vm.warp(100_000);
        vm.prank(ADMIN);
        engine.setVolatilityFeedId(BRIDGED_ETH, ETHUSD_VGK_FEED_ID);
        // Set price with a timestamp 2 hours (7200s) ago -- beyond 3600s staleness threshold
        uint64 staleTimestamp = uint64((block.timestamp - 7200) * 1e9);
        mockStork.setPrice(ETHUSD_VGK_FEED_ID, int192(uint192(50e16)), staleTimestamp);
        // Stale volatility should return 0 from _readVolatility, so LTV = baseLTV
        uint256 ltv = engine.getEffectiveLTV(BRIDGED_ETH);
        assertEq(ltv, BASE_LTV, "Stale vol data should fall back to base LTV");
    }

    /// @notice setBaseLTV emits BaseLTVConfigured event
    function test_setBaseLTV_emitsEvent() public {
        vm.prank(ADMIN);
        vm.expectEmit(true, false, false, true);
        emit IRiskParameterEngine.BaseLTVConfigured(BRIDGED_ETH, 65e16);
        engine.setBaseLTV(BRIDGED_ETH, 65e16);
    }

    // ================================================================
    // Fuzz Tests
    // ================================================================

    /// @notice Fuzz: random volatility values produce valid LTV within [30%, 75%] bounds
    function testFuzz_effectiveLTV_validRange(uint256 vol) public {
        vol = bound(vol, 0, 200e16); // 0% to 200%
        _setupVolatilityFeed(vol);
        uint256 ltv = engine.getEffectiveLTV(BRIDGED_ETH);
        assertTrue(ltv >= MIN_LTV_FLOOR, "LTV should be >= 30%");
        assertTrue(ltv <= BASE_LTV, "LTV should be <= 75%");
    }

    /// @notice Fuzz: threshold always equals LTV + 7%
    function testFuzz_threshold_equalsLTVPlusBuffer(uint256 vol) public {
        vol = bound(vol, 0, 200e16);
        _setupVolatilityFeed(vol);
        uint256 ltv = engine.getEffectiveLTV(BRIDGED_ETH);
        uint256 threshold = engine.getLiquidationThreshold(BRIDGED_ETH);
        assertEq(threshold, ltv + LIQ_BUFFER, "Threshold should always be LTV + buffer");
    }

    /// @notice Fuzz: LTV decreases monotonically as volatility increases
    function testFuzz_effectiveLTV_monotonicDecrease(uint256 vol1, uint256 vol2) public {
        vol1 = bound(vol1, 0, 200e16);
        vol2 = bound(vol2, vol1, 200e16);

        _setupVolatilityFeed(vol1);
        uint256 ltv1 = engine.getEffectiveLTV(BRIDGED_ETH);

        // Update volatility to higher value
        mockStork.setPriceNow(ETHUSD_VGK_FEED_ID, int192(uint192(vol2)));
        uint256 ltv2 = engine.getEffectiveLTV(BRIDGED_ETH);

        assertTrue(ltv2 <= ltv1, "LTV should decrease as vol increases");
    }
}
