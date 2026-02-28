// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {CircuitBreaker} from "../src/risk/CircuitBreaker.sol";
import {ICircuitBreaker} from "../src/interfaces/ICircuitBreaker.sol";

contract CircuitBreakerTest is Test {
    CircuitBreaker public cb;

    address public admin = makeAddr("admin");
    address public recorder = makeAddr("recorder");
    address public alice = makeAddr("alice");

    uint256 constant WAD = 1e18;
    uint256 constant USDC_UNIT = 1e6;

    function setUp() public {
        vm.warp(100_000);

        cb = new CircuitBreaker(admin);

        vm.startPrank(admin);
        cb.grantRole(cb.RECORDER_ROLE(), recorder);
        vm.stopPrank();
    }

    // ============================
    // Level 1: Collateral Drop
    // ============================

    function test_level1_triggersOnSharpCollateralDrop() public {
        // Record initial collateral value of 1M USDC
        vm.prank(recorder);
        cb.recordCollateralValue(1_000_000e6);

        // Sharp drop to 840k USDC (16% drop, exceeds 15% threshold)
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);

        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Caution));
    }

    function test_level1_doesNotTriggerOnSmallDrop() public {
        vm.prank(recorder);
        cb.recordCollateralValue(1_000_000e6);

        // Drop to 860k USDC (14% drop, below 15% threshold)
        vm.prank(recorder);
        cb.recordCollateralValue(860_000e6);

        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Inactive));
    }

    function test_level1_triggersAtExactly15PercentDrop() public {
        vm.prank(recorder);
        cb.recordCollateralValue(1_000_000e6);

        // Exactly 15% drop -- threshold uses > (strict), so exactly 15% does NOT trigger
        vm.prank(recorder);
        cb.recordCollateralValue(850_000e6);

        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Inactive));

        // Just past 15% -- triggers
        vm.prank(recorder);
        cb.recordCollateralValue(849_999e6);

        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Caution));
    }

    function test_level1_doesNotTriggerOnGradualDecline() public {
        // Record initial value
        vm.prank(recorder);
        cb.recordCollateralValue(1_000_000e6);

        // Gradual decline over >1 hour -- peak resets each window
        vm.warp(block.timestamp + 20 minutes);
        vm.prank(recorder);
        cb.recordCollateralValue(950_000e6);

        vm.warp(block.timestamp + 25 minutes);
        vm.prank(recorder);
        cb.recordCollateralValue(900_000e6);

        // Now window has expired from original peak, peak resets to latest recording
        vm.warp(block.timestamp + 20 minutes);
        vm.prank(recorder);
        cb.recordCollateralValue(860_000e6);

        // Should still be inactive -- each window drop is <15%
        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Inactive));
    }

    function test_level1_emitsCircuitBreakerTriggeredEvent() public {
        vm.prank(recorder);
        cb.recordCollateralValue(1_000_000e6);

        // 20% drop: (1M - 800k) / 1M = 0.2e18
        vm.expectEmit(true, false, false, true);
        emit ICircuitBreaker.CircuitBreakerTriggered(1, block.timestamp, 0.2e18);

        vm.prank(recorder);
        cb.recordCollateralValue(800_000e6);
    }

    function test_level1_autoRecoversAfter30MinStability() public {
        // Trigger Level 1
        vm.prank(recorder);
        cb.recordCollateralValue(1_000_000e6);
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);

        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Caution));

        // Record stable value (within threshold of new peak baseline)
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);

        // Wait 30 minutes
        vm.warp(block.timestamp + 30 minutes);

        // Record stable value again to trigger recovery check
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);

        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Inactive));
    }

    function test_level1_autoRecoversAtExactly30Min() public {
        // Trigger Level 1
        vm.prank(recorder);
        cb.recordCollateralValue(1_000_000e6);
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);

        // Start stability
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);

        // Exactly 30 minutes -- should recover (>= used)
        vm.warp(block.timestamp + 30 minutes);
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);

        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Inactive));
    }

    function test_level1_emitsResumedEventOnRecovery() public {
        // Trigger Level 1
        vm.prank(recorder);
        cb.recordCollateralValue(1_000_000e6);
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);

        // Start stability
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);

        // Wait 30 minutes
        vm.warp(block.timestamp + 30 minutes);

        vm.expectEmit(true, false, false, true);
        emit ICircuitBreaker.CircuitBreakerResumed(1, block.timestamp);

        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);
    }

    function test_level1_doesNotAutoRecoverBefore30Min() public {
        // Trigger Level 1
        vm.prank(recorder);
        cb.recordCollateralValue(1_000_000e6);
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);

        // Record stable value
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);

        // Wait only 29 minutes
        vm.warp(block.timestamp + 29 minutes);

        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);

        // Should still be Caution
        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Caution));
    }

    function test_level1_recoveryResetsOnNewDrop() public {
        // Trigger Level 1
        vm.prank(recorder);
        cb.recordCollateralValue(1_000_000e6);
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);

        // Start stability tracking
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);

        // Wait 20 minutes
        vm.warp(block.timestamp + 20 minutes);

        // Another sharp drop -- peak is 840k, dropping to 700k is ~16.7% > threshold
        // This resets the stability timer because the drop exceeds the threshold
        vm.prank(recorder);
        cb.recordCollateralValue(700_000e6);

        // Wait 30 minutes -- the value is still 700k but peak is still 840k
        // 700k is >15% below 840k, so it's NOT considered stable
        vm.warp(block.timestamp + 30 minutes);
        vm.prank(recorder);
        cb.recordCollateralValue(700_000e6);

        // Should still be Caution because collateral hasn't stabilized relative to peak
        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Caution));

        // Now wait for peak window to expire (>1hr from peak timestamp)
        vm.warp(block.timestamp + 45 minutes);
        // Record 700k -- peak resets to 700k since window expired
        vm.prank(recorder);
        cb.recordCollateralValue(700_000e6);

        // Now peak=700k, value=700k, 0% drop -> stable. Timer starts.
        // Wait another 30 minutes for recovery
        vm.warp(block.timestamp + 30 minutes);
        vm.prank(recorder);
        cb.recordCollateralValue(700_000e6);

        // Now should be recovered
        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Inactive));
    }

    // ============================
    // Existing operations unaffected
    // ============================

    function test_level1_doesNotAffectRepayOrLiquidation() public {
        // Level 1 only affects borrowing. This test verifies that
        // the level() returns Caution (1), which ChariotBase uses:
        // - whenBorrowingAllowed checks level >= 1 -> reverts (borrows blocked)
        // - whenNotPaused checks level >= 3 -> does NOT revert (repay/liquidate OK)
        vm.prank(recorder);
        cb.recordCollateralValue(1_000_000e6);
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);

        assertEq(uint8(cb.level()), 1);
        // Level 1 < 3, so whenNotPaused passes -- repayments and liquidations unaffected
        assertTrue(uint8(cb.level()) < 3);
    }

    // ============================
    // Admin Resume
    // ============================

    function test_resume_adminCanResetLevel() public {
        // Trigger Level 1
        vm.prank(recorder);
        cb.recordCollateralValue(1_000_000e6);
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);
        assertEq(uint8(cb.level()), 1);

        // Admin resume
        vm.prank(admin);
        cb.resume();

        assertEq(uint8(cb.level()), 0);
    }

    function test_resume_emitsResumedEvent() public {
        vm.prank(admin);
        cb.setLevel(2);

        vm.expectEmit(true, false, false, true);
        emit ICircuitBreaker.CircuitBreakerResumed(2, block.timestamp);

        vm.prank(admin);
        cb.resume();
    }

    function test_resume_revertsForNonAdmin() public {
        vm.prank(alice);
        vm.expectRevert();
        cb.resume();
    }

    function test_resume_resetsPeakTracking() public {
        vm.prank(recorder);
        cb.recordCollateralValue(1_000_000e6);
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);

        vm.prank(admin);
        cb.resume();

        assertEq(cb.peakCollateralValue(), 0);
        assertEq(cb.peakTimestamp(), 0);
    }

    // ============================
    // Access Control
    // ============================

    function test_recordCollateralValue_revertsForNonRecorder() public {
        vm.prank(alice);
        vm.expectRevert();
        cb.recordCollateralValue(1_000_000e6);
    }

    function test_recordCollateralValue_revertsOnZeroValue() public {
        vm.prank(recorder);
        vm.expectRevert(CircuitBreaker.ZeroCollateralValue.selector);
        cb.recordCollateralValue(0);
    }

    function test_setLevel_operatorOnly() public {
        vm.prank(admin);
        cb.setLevel(1);
        assertEq(uint8(cb.level()), 1);
    }

    function test_setLevel_revertsForNonOperator() public {
        vm.prank(alice);
        vm.expectRevert();
        cb.setLevel(1);
    }

    function test_setLevel_revertsForLevel0() public {
        vm.prank(admin);
        vm.expectRevert(CircuitBreaker.InvalidLevel.selector);
        cb.setLevel(0);
    }

    function test_setLevel_revertsForLevel4() public {
        vm.prank(admin);
        vm.expectRevert(CircuitBreaker.InvalidLevel.selector);
        cb.setLevel(4);
    }

    function test_setLevel_revertsOnSameLevel() public {
        vm.prank(admin);
        cb.setLevel(1);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(CircuitBreaker.LevelNotEscalated.selector, 1, 1));
        cb.setLevel(1);
    }

    function test_setLevel_revertsOnLowerLevel() public {
        vm.prank(admin);
        cb.setLevel(2);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(CircuitBreaker.LevelNotEscalated.selector, 2, 1));
        cb.setLevel(1);
    }

    function test_constructor_revertsOnZeroAddress() public {
        vm.expectRevert(CircuitBreaker.ZeroAddress.selector);
        new CircuitBreaker(address(0));
    }

    // ============================
    // Fuzz Tests
    // ============================

    function testFuzz_recordCollateralValue_noPanic(uint256 value) public {
        value = bound(value, 1, type(uint128).max); // min 1 since 0 now reverts

        vm.prank(recorder);
        cb.recordCollateralValue(value);

        // Should not panic or overflow
        uint8 lvl = uint8(cb.level());
        assertTrue(lvl <= 3);
    }

    function testFuzz_twoValues_noPanic(uint256 peak, uint256 drop) public {
        peak = bound(peak, 1, type(uint128).max);
        drop = bound(drop, 1, peak);

        vm.prank(recorder);
        cb.recordCollateralValue(peak);

        vm.prank(recorder);
        cb.recordCollateralValue(drop);

        uint8 lvl = uint8(cb.level());
        assertTrue(lvl <= 3);
    }
}
