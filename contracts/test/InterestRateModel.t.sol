// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {InterestRateModel} from "../src/risk/InterestRateModel.sol";

contract InterestRateModelTest is Test {
    InterestRateModel public model;

    uint256 constant WAD = 1e18;

    function setUp() public {
        model = new InterestRateModel();
    }

    // ================================================================
    // Borrow Rate Tests -- Below Kink
    // ================================================================

    function test_borrowRate_at0Percent() public view {
        uint256 rate = model.getBorrowRate(0);
        assertEq(rate, 0, "Rate at 0% should be 0%");
    }

    function test_borrowRate_at20Percent() public view {
        // 4% * (20/80) = 4% * 0.25 = 1.0%
        uint256 rate = model.getBorrowRate(0.2e18);
        assertEq(rate, 0.01e18, "Rate at 20% should be 1.0%");
    }

    function test_borrowRate_at40Percent() public view {
        // 4% * (40/80) = 4% * 0.5 = 2.0%
        uint256 rate = model.getBorrowRate(0.4e18);
        assertEq(rate, 0.02e18, "Rate at 40% should be 2.0%");
    }

    function test_borrowRate_at60Percent() public view {
        // 4% * (60/80) = 4% * 0.75 = 3.0%
        uint256 rate = model.getBorrowRate(0.6e18);
        assertEq(rate, 0.03e18, "Rate at 60% should be 3.0%");
    }

    function test_borrowRate_at80Percent_kink() public view {
        // 4% * (80/80) = 4%
        uint256 rate = model.getBorrowRate(0.8e18);
        assertEq(rate, 0.04e18, "Rate at 80% (kink) should be 4.0%");
    }

    // ================================================================
    // Borrow Rate Tests -- Above Kink
    // ================================================================

    function test_borrowRate_at90Percent() public view {
        // 4% + 75% * ((90-80)/(100-80)) = 4% + 75% * 0.5 = 4% + 37.5% = 41.5%
        uint256 rate = model.getBorrowRate(0.9e18);
        assertEq(rate, 0.415e18, "Rate at 90% should be 41.5%");
    }

    function test_borrowRate_at95Percent() public view {
        // 4% + 75% * ((95-80)/(100-80)) = 4% + 75% * 0.75 = 4% + 56.25% = 60.25%
        uint256 rate = model.getBorrowRate(0.95e18);
        assertEq(rate, 0.6025e18, "Rate at 95% should be 60.25%");
    }

    function test_borrowRate_at100Percent() public view {
        // 4% + 75% * ((100-80)/(100-80)) = 4% + 75% = 79%
        uint256 rate = model.getBorrowRate(WAD);
        assertEq(rate, 0.79e18, "Rate at 100% should be 79%");
    }

    // ================================================================
    // Kink Behavior Tests
    // ================================================================

    function test_kink_justBelowAndAt() public view {
        uint256 rateBelowKink = model.getBorrowRate(0.7999e18);
        uint256 rateAtKink = model.getBorrowRate(0.8e18);

        // Rate just below kink should be close to but slightly less than rate at kink
        assertTrue(rateBelowKink < rateAtKink, "Rate below kink should be less than at kink");
    }

    function test_kink_justAbove() public view {
        uint256 rateAtKink = model.getBorrowRate(0.8e18);
        uint256 rateAboveKink = model.getBorrowRate(0.8001e18);

        // Rate just above kink should be higher due to steep slope
        assertTrue(rateAboveKink > rateAtKink, "Rate above kink should be greater than at kink");
    }

    // ================================================================
    // Utilisation Tests
    // ================================================================

    function test_getUtilisation_withKnownValues() public view {
        // 500 borrowed / 1000 deposited = 50%
        uint256 util = model.getUtilisation(500e6, 1000e6);
        assertEq(util, 0.5e18, "Utilisation should be 50%");
    }

    function test_getUtilisation_zeroDeposits() public view {
        uint256 util = model.getUtilisation(100e6, 0);
        assertEq(util, 0, "Utilisation with zero deposits should be 0");
    }

    function test_getUtilisation_cappedAt100() public view {
        // Edge case: borrowed > deposits
        uint256 util = model.getUtilisation(1500e6, 1000e6);
        assertEq(util, WAD, "Utilisation should cap at 100%");
    }

    // ================================================================
    // Supply Rate Tests
    // ================================================================

    function test_supplyRate_withReserveFactor() public view {
        // At 80% utilisation: borrowRate = 4%, supplyRate = 4% * 80% * 90% = 2.88%
        uint256 supplyRate = model.getSupplyRate(0.8e18);
        assertEq(supplyRate, 0.0288e18, "Supply rate at 80% should be 2.88%");
    }

    function test_reserveFactor_isTenPercent() public view {
        assertEq(model.getReserveFactor(), 0.1e18, "Reserve factor should be 10%");
    }

    // ================================================================
    // Edge Cases
    // ================================================================

    function test_borrowRate_cappedAbove100() public view {
        // Utilisation > 100% should be capped
        uint256 rate = model.getBorrowRate(1.5e18);
        uint256 rateAt100 = model.getBorrowRate(WAD);
        assertEq(rate, rateAt100, "Rate should be capped at 100% utilisation");
    }

    // ================================================================
    // Fuzz Tests
    // ================================================================

    function testFuzz_borrowRate_monotonicallyIncreasing(uint256 u1, uint256 u2) public view {
        u1 = bound(u1, 0, WAD);
        u2 = bound(u2, u1, WAD);

        uint256 rate1 = model.getBorrowRate(u1);
        uint256 rate2 = model.getBorrowRate(u2);
        assertTrue(rate2 >= rate1, "Borrow rate should be monotonically increasing");
    }

    function testFuzz_borrowRate_validRange(uint256 utilisation) public view {
        utilisation = bound(utilisation, 0, WAD);

        uint256 rate = model.getBorrowRate(utilisation);
        // Rate should be between 0% and 79%
        assertTrue(rate <= 0.79e18, "Rate should never exceed 79%");
    }

    function testFuzz_supplyRate_neverExceedsBorrowRate(uint256 utilisation) public view {
        utilisation = bound(utilisation, 0, WAD);

        uint256 borrowRate = model.getBorrowRate(utilisation);
        uint256 supplyRate = model.getSupplyRate(utilisation);
        assertTrue(supplyRate <= borrowRate, "Supply rate should never exceed borrow rate");
    }
}
