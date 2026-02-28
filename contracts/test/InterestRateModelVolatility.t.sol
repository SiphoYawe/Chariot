// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {InterestRateModel} from "../src/risk/InterestRateModel.sol";
import {RiskParameterEngine} from "../src/risk/RiskParameterEngine.sol";
import {IInterestRateModel} from "../src/interfaces/IInterestRateModel.sol";
import {MockStork} from "./mocks/MockStork.sol";

contract InterestRateModelVolatilityTest is Test {
    InterestRateModel public model;
    RiskParameterEngine public engine;
    MockStork public mockStork;

    address constant ADMIN = address(0xAD);
    address constant NON_ADMIN = address(0x1234);
    address constant BRIDGED_ETH = address(0xBE);
    address constant OTHER_TOKEN = address(0xCC);
    bytes32 constant ETHUSD_VGK_FEED_ID = keccak256("ETHUSD_VGK");

    uint256 constant WAD = 1e18;
    uint256 constant K_VOL = 50e16; // 0.5 in WAD
    uint256 constant BASELINE_VOL = 25e16; // 25%

    function setUp() public {
        // Deploy mock oracle
        mockStork = new MockStork();

        // Deploy RiskParameterEngine
        engine = new RiskParameterEngine(address(mockStork), ADMIN);

        // Configure base LTV and volatility feed for BridgedETH
        vm.startPrank(ADMIN);
        engine.setBaseLTV(BRIDGED_ETH, 75e16);
        engine.setVolatilityFeedId(BRIDGED_ETH, ETHUSD_VGK_FEED_ID);
        vm.stopPrank();

        // Deploy InterestRateModel (deployer gets ADMIN role)
        model = new InterestRateModel();

        // Wire dependencies: set RiskParameterEngine and k_vol
        model.setRiskParameterEngine(address(engine));
        model.setKVolCoefficient(BRIDGED_ETH, K_VOL);
    }

    /// @dev Helper: set volatility in mock oracle
    function _setVolatility(uint256 volWad) internal {
        mockStork.setPriceNow(ETHUSD_VGK_FEED_ID, int192(uint192(volWad)));
    }

    // ================================================================
    // Volatility Premium Tests (AC: 1-4)
    // ================================================================

    /// @notice AC2: Vol 35% -- premium = 0.5 * (35% - 25%) = 0.5 * 10% = 5%
    function test_volatilityPremium_at35Percent() public {
        _setVolatility(35e16);
        uint256 premium = model.getVolatilityPremium(BRIDGED_ETH);
        assertEq(premium, 5e16, "Premium at 35% vol should be 5%");
    }

    /// @notice AC3: Vol 50% -- premium = 0.5 * (50% - 25%) = 0.5 * 25% = 12.5%
    function test_volatilityPremium_at50Percent() public {
        _setVolatility(50e16);
        uint256 premium = model.getVolatilityPremium(BRIDGED_ETH);
        assertEq(premium, 125e15, "Premium at 50% vol should be 12.5%");
    }

    /// @notice AC4: Vol 20% (below baseline) -- premium = 0%
    function test_volatilityPremium_belowBaseline() public {
        _setVolatility(20e16);
        uint256 premium = model.getVolatilityPremium(BRIDGED_ETH);
        assertEq(premium, 0, "Premium below baseline should be 0%");
    }

    /// @notice AC4: Vol exactly 25% (at baseline) -- premium = 0%
    function test_volatilityPremium_atBaseline() public {
        _setVolatility(25e16);
        uint256 premium = model.getVolatilityPremium(BRIDGED_ETH);
        assertEq(premium, 0, "Premium at baseline should be 0%");
    }

    /// @notice AC1: Vol 0% -- premium = 0%
    function test_volatilityPremium_atZeroVol() public {
        _setVolatility(0);
        uint256 premium = model.getVolatilityPremium(BRIDGED_ETH);
        assertEq(premium, 0, "Premium at zero vol should be 0%");
    }

    /// @notice Vol 100% -- premium = 0.5 * (100% - 25%) = 37.5%
    function test_volatilityPremium_at100Percent() public {
        _setVolatility(100e16);
        uint256 premium = model.getVolatilityPremium(BRIDGED_ETH);
        assertEq(premium, 375e15, "Premium at 100% vol should be 37.5%");
    }

    // ================================================================
    // Total Borrow Rate with Volatility Tests (AC: 5)
    // ================================================================

    /// @notice AC5: total rate = base utilisation rate + volatility premium
    /// At 80% util (kink) = 4% base + 5% premium (35% vol) = 9%
    function test_borrowRateWithVolatility_atKink_35Vol() public {
        _setVolatility(35e16);
        uint256 totalRate = model.getBorrowRateWithVolatility(0.8e18, BRIDGED_ETH);
        uint256 baseRate = model.getBorrowRate(0.8e18);
        uint256 premium = model.getVolatilityPremium(BRIDGED_ETH);
        assertEq(baseRate, 0.04e18, "Base rate at 80% should be 4%");
        assertEq(premium, 5e16, "Premium at 35% vol should be 5%");
        assertEq(totalRate, baseRate + premium, "Total rate should be base + premium");
        assertEq(totalRate, 0.09e18, "Total rate should be 9%");
    }

    /// @notice AC5: total rate at 50% vol stress -- base 4% + premium 12.5% = 16.5%
    function test_borrowRateWithVolatility_atKink_50Vol() public {
        _setVolatility(50e16);
        uint256 totalRate = model.getBorrowRateWithVolatility(0.8e18, BRIDGED_ETH);
        assertEq(totalRate, 0.165e18, "Total rate should be 16.5% at kink with 50% vol");
    }

    /// @notice AC5: calm market -- total rate equals base rate
    function test_borrowRateWithVolatility_calmMarket() public {
        _setVolatility(20e16);
        uint256 totalRate = model.getBorrowRateWithVolatility(0.8e18, BRIDGED_ETH);
        uint256 baseRate = model.getBorrowRate(0.8e18);
        assertEq(totalRate, baseRate, "Total rate in calm market should equal base rate");
    }

    /// @notice Total rate at different utilisation points with volatility
    function test_borrowRateWithVolatility_at40PercentUtil() public {
        _setVolatility(35e16);
        uint256 totalRate = model.getBorrowRateWithVolatility(0.4e18, BRIDGED_ETH);
        // Base at 40% util = 4% * (40/80) = 2%
        // Premium at 35% vol = 5%
        // Total = 7%
        assertEq(totalRate, 0.07e18, "Total rate at 40% util, 35% vol should be 7%");
    }

    // ================================================================
    // Rate Breakdown Tests (AC: 1-5)
    // ================================================================

    /// @notice Rate breakdown returns correct component values
    function test_rateBreakdown_at35Vol() public {
        _setVolatility(35e16);
        (uint256 baseRate, uint256 volatilityPremium, uint256 totalRate) = model.getRateBreakdown(0.8e18, BRIDGED_ETH);
        assertEq(baseRate, 0.04e18, "Base rate should be 4%");
        assertEq(volatilityPremium, 5e16, "Premium should be 5%");
        assertEq(totalRate, 0.09e18, "Total should be 9%");
    }

    /// @notice Rate breakdown in calm market -- premium is 0
    function test_rateBreakdown_calmMarket() public {
        _setVolatility(20e16);
        (uint256 baseRate, uint256 volatilityPremium, uint256 totalRate) = model.getRateBreakdown(0.8e18, BRIDGED_ETH);
        assertEq(baseRate, 0.04e18, "Base rate should be 4%");
        assertEq(volatilityPremium, 0, "Premium should be 0%");
        assertEq(totalRate, 0.04e18, "Total should be 4%");
    }

    /// @notice Breakdown total matches getBorrowRateWithVolatility
    function test_rateBreakdown_matchesBorrowRateWithVolatility() public {
        _setVolatility(50e16);
        (,, uint256 totalFromBreakdown) = model.getRateBreakdown(0.9e18, BRIDGED_ETH);
        uint256 totalDirect = model.getBorrowRateWithVolatility(0.9e18, BRIDGED_ETH);
        assertEq(totalFromBreakdown, totalDirect, "Breakdown total should match direct call");
    }

    // ================================================================
    // Fallback / Graceful Degradation Tests
    // ================================================================

    /// @notice No RiskParameterEngine set -- premium is 0
    function test_volatilityPremium_noEngine() public {
        InterestRateModel freshModel = new InterestRateModel();
        // No setRiskParameterEngine called
        uint256 premium = freshModel.getVolatilityPremium(BRIDGED_ETH);
        assertEq(premium, 0, "Premium without engine should be 0");
    }

    /// @notice No k_vol configured for token -- premium is 0
    function test_volatilityPremium_noKVol() public {
        _setVolatility(50e16);
        // OTHER_TOKEN has no k_vol configured
        uint256 premium = model.getVolatilityPremium(OTHER_TOKEN);
        assertEq(premium, 0, "Premium without k_vol should be 0");
    }

    /// @notice No engine -- getBorrowRateWithVolatility returns base rate only
    function test_borrowRateWithVolatility_noEngine() public {
        InterestRateModel freshModel = new InterestRateModel();
        uint256 totalRate = freshModel.getBorrowRateWithVolatility(0.8e18, BRIDGED_ETH);
        uint256 baseRate = freshModel.getBorrowRate(0.8e18);
        assertEq(totalRate, baseRate, "Without engine, total rate should equal base rate");
    }

    // ================================================================
    // Admin Access Control Tests
    // ================================================================

    /// @notice setKVolCoefficient requires ADMIN_ROLE
    function test_setKVolCoefficient_requiresAdmin() public {
        vm.prank(NON_ADMIN);
        vm.expectRevert();
        model.setKVolCoefficient(BRIDGED_ETH, 50e16);
    }

    /// @notice setRiskParameterEngine requires ADMIN_ROLE
    function test_setRiskParameterEngine_requiresAdmin() public {
        vm.prank(NON_ADMIN);
        vm.expectRevert();
        model.setRiskParameterEngine(address(engine));
    }

    /// @notice setKVolCoefficient succeeds for admin
    function test_setKVolCoefficient_succeeds() public {
        model.setKVolCoefficient(BRIDGED_ETH, 60e16);
        assertEq(model.getKVolCoefficient(BRIDGED_ETH), 60e16, "k_vol should be updated");
    }

    /// @notice setKVolCoefficient reverts for zero address collateral
    function test_setKVolCoefficient_revertsZeroAddress() public {
        vm.expectRevert(InterestRateModel.CollateralNotConfigured.selector);
        model.setKVolCoefficient(address(0), 50e16);
    }

    /// @notice setRiskParameterEngine emits event
    function test_setRiskParameterEngine_emitsEvent() public {
        address newEngine = address(0x999);
        vm.expectEmit(true, true, false, false);
        emit InterestRateModel.RiskParameterEngineUpdated(address(engine), newEngine);
        model.setRiskParameterEngine(newEngine);
    }

    /// @notice setKVolCoefficient emits event
    function test_setKVolCoefficient_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit InterestRateModel.KVolCoefficientUpdated(BRIDGED_ETH, 60e16);
        model.setKVolCoefficient(BRIDGED_ETH, 60e16);
    }

    /// @notice setKVolCoefficient reverts for zero kVol
    function test_setKVolCoefficient_revertsZeroKVol() public {
        vm.expectRevert(InterestRateModel.InvalidKVolCoefficient.selector);
        model.setKVolCoefficient(BRIDGED_ETH, 0);
    }

    /// @notice setKVolCoefficient reverts for kVol above MAX_K_VOL
    function test_setKVolCoefficient_revertsAboveMax() public {
        vm.expectRevert(InterestRateModel.InvalidKVolCoefficient.selector);
        model.setKVolCoefficient(BRIDGED_ETH, 5e18 + 1);
    }

    /// @notice setKVolCoefficient succeeds at MAX_K_VOL boundary
    function test_setKVolCoefficient_atMaxKVol() public {
        model.setKVolCoefficient(BRIDGED_ETH, 5e18);
        assertEq(model.getKVolCoefficient(BRIDGED_ETH), 5e18, "k_vol should be set to MAX");
    }

    /// @notice setRiskParameterEngine reverts for zero address
    function test_setRiskParameterEngine_revertsZeroAddress() public {
        vm.expectRevert(InterestRateModel.ZeroAddress.selector);
        model.setRiskParameterEngine(address(0));
    }

    // ================================================================
    // Oracle Failure Graceful Degradation Tests
    // ================================================================

    /// @notice Oracle revert (feed not found) degrades gracefully to 0 premium
    function test_volatilityPremium_oracleRevert_gracefulFallback() public {
        // Configure k_vol for OTHER_TOKEN but don't set oracle feed in engine
        // This means engine.getCurrentVolatility will try to read from oracle
        // and the oracle will revert (no feed data)
        vm.prank(ADMIN);
        engine.setBaseLTV(OTHER_TOKEN, 70e16);

        // Set a feed ID but don't actually set data in mock oracle
        vm.prank(ADMIN);
        engine.setVolatilityFeedId(OTHER_TOKEN, keccak256("MISSING_FEED"));

        model.setKVolCoefficient(OTHER_TOKEN, 50e16);

        // Should return 0 premium, not revert
        uint256 premium = model.getVolatilityPremium(OTHER_TOKEN);
        assertEq(premium, 0, "Oracle failure should return 0 premium");
    }

    /// @notice getBorrowRateWithVolatility degrades to base rate on oracle failure
    function test_borrowRateWithVolatility_oracleFailure_degradesToBase() public {
        vm.prank(ADMIN);
        engine.setBaseLTV(OTHER_TOKEN, 70e16);
        vm.prank(ADMIN);
        engine.setVolatilityFeedId(OTHER_TOKEN, keccak256("MISSING_FEED"));
        model.setKVolCoefficient(OTHER_TOKEN, 50e16);

        uint256 totalRate = model.getBorrowRateWithVolatility(0.8e18, OTHER_TOKEN);
        uint256 baseRate = model.getBorrowRate(0.8e18);
        assertEq(totalRate, baseRate, "Oracle failure should degrade to base rate");
    }

    // ================================================================
    // Supply Rate with Volatility Tests
    // ================================================================

    /// @notice Supply rate with volatility includes premium effect
    function test_supplyRateWithVolatility_at35Vol() public {
        _setVolatility(35e16);
        uint256 supplyRate = model.getSupplyRateWithVolatility(0.8e18, BRIDGED_ETH);
        // borrowRate = 4% + 5% = 9%
        // supplyRate = 9% * 80% * 90% = 6.48%
        assertEq(supplyRate, 0.0648e18, "Supply rate with vol should be 6.48%");
    }

    /// @notice Supply rate with volatility in calm market matches base supply rate
    function test_supplyRateWithVolatility_calmMarket() public {
        _setVolatility(20e16);
        uint256 supplyRateVol = model.getSupplyRateWithVolatility(0.8e18, BRIDGED_ETH);
        uint256 supplyRateBase = model.getSupplyRate(0.8e18);
        assertEq(supplyRateVol, supplyRateBase, "Calm market vol supply rate should match base");
    }

    // ================================================================
    // Different k_vol Coefficients Per Token (AC: 1)
    // ================================================================

    /// @notice Different k_vol per collateral token
    function test_differentKVolPerToken() public {
        // Configure OTHER_TOKEN with different k_vol and feed
        bytes32 otherFeedId = keccak256("OTHER_VGK");

        vm.startPrank(ADMIN);
        engine.setBaseLTV(OTHER_TOKEN, 70e16);
        engine.setVolatilityFeedId(OTHER_TOKEN, otherFeedId);
        vm.stopPrank();

        // Set k_vol=30e16 (0.3) for OTHER_TOKEN
        model.setKVolCoefficient(OTHER_TOKEN, 30e16);

        // Set same volatility for both tokens
        mockStork.setPriceNow(ETHUSD_VGK_FEED_ID, int192(uint192(35e16)));
        mockStork.setPriceNow(otherFeedId, int192(uint192(35e16)));

        uint256 premiumETH = model.getVolatilityPremium(BRIDGED_ETH);
        uint256 premiumOther = model.getVolatilityPremium(OTHER_TOKEN);

        // ETH: 0.5 * 10% = 5%
        assertEq(premiumETH, 5e16, "ETH premium should be 5%");
        // Other: 0.3 * 10% = 3%
        assertEq(premiumOther, 3e16, "Other premium should be 3%");
    }

    // ================================================================
    // View Function Tests
    // ================================================================

    /// @notice getKVolCoefficient returns stored value
    function test_getKVolCoefficient() public view {
        assertEq(model.getKVolCoefficient(BRIDGED_ETH), K_VOL, "Should return configured k_vol");
    }

    /// @notice getRiskParameterEngine returns stored address
    function test_getRiskParameterEngine() public view {
        assertEq(model.getRiskParameterEngine(), address(engine), "Should return configured engine");
    }

    // ================================================================
    // Existing Base Rate Functionality Still Works
    // ================================================================

    /// @notice Base getBorrowRate unchanged by volatility premium extension
    function test_baseRateUnchanged_at80Percent() public view {
        uint256 rate = model.getBorrowRate(0.8e18);
        assertEq(rate, 0.04e18, "Base rate at 80% should still be 4%");
    }

    /// @notice Supply rate calculation unchanged
    function test_supplyRateUnchanged() public view {
        uint256 supplyRate = model.getSupplyRate(0.8e18);
        assertEq(supplyRate, 0.0288e18, "Supply rate at 80% should still be 2.88%");
    }

    // ================================================================
    // Fuzz Tests
    // ================================================================

    /// @notice Fuzz: random volatility values produce valid premium >= 0
    function testFuzz_volatilityPremium_nonnegative(uint256 vol) public {
        vol = bound(vol, 0, 200e16); // 0% to 200%
        _setVolatility(vol);
        uint256 premium = model.getVolatilityPremium(BRIDGED_ETH);
        assertTrue(premium >= 0, "Premium should always be >= 0");
    }

    /// @notice Fuzz: total rate always >= base rate
    function testFuzz_totalRate_geBaseRate(uint256 util, uint256 vol) public {
        util = bound(util, 0, WAD);
        vol = bound(vol, 0, 200e16);
        _setVolatility(vol);

        uint256 baseRate = model.getBorrowRate(util);
        uint256 totalRate = model.getBorrowRateWithVolatility(util, BRIDGED_ETH);
        assertTrue(totalRate >= baseRate, "Total rate should always be >= base rate");
    }

    /// @notice Fuzz: premium increases monotonically with volatility
    function testFuzz_premium_monotonicIncrease(uint256 vol1, uint256 vol2) public {
        vol1 = bound(vol1, 0, 200e16);
        vol2 = bound(vol2, vol1, 200e16);

        _setVolatility(vol1);
        uint256 premium1 = model.getVolatilityPremium(BRIDGED_ETH);

        _setVolatility(vol2);
        uint256 premium2 = model.getVolatilityPremium(BRIDGED_ETH);

        assertTrue(premium2 >= premium1, "Premium should increase with volatility");
    }

    /// @notice Fuzz: breakdown components sum to total
    function testFuzz_breakdown_sumEqualsTotal(uint256 util, uint256 vol) public {
        util = bound(util, 0, WAD);
        vol = bound(vol, 0, 200e16);
        _setVolatility(vol);

        (uint256 baseRate, uint256 premium, uint256 totalRate) = model.getRateBreakdown(util, BRIDGED_ETH);
        assertEq(totalRate, baseRate + premium, "Breakdown components should sum to total");
    }
}
