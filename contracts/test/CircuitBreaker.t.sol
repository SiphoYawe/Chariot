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
    // Level 2: Withdrawal Rate Limiting
    // ============================

    function test_level2_triggersOnHighWithdrawalRate() public {
        uint256 poolTotal = 1_000_000e6; // 1M USDC pool

        // Withdraw 210k (21% > 20% threshold)
        vm.prank(recorder);
        cb.recordWithdrawal(210_000e6, poolTotal);

        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Stress));
    }

    function test_level2_doesNotTriggerBelowThreshold() public {
        uint256 poolTotal = 1_000_000e6;

        // Withdraw 190k (19% < 20% threshold)
        vm.prank(recorder);
        cb.recordWithdrawal(190_000e6, poolTotal);

        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Inactive));
    }

    function test_level2_perAddressRateLimitCapsAt5Percent() public {
        uint256 poolTotal = 1_000_000e6;
        uint256 largePosition = 10_000e6; // Large depositor (above small depositor threshold)

        // Trigger Level 2
        vm.prank(recorder);
        cb.recordWithdrawal(210_000e6, poolTotal);
        assertEq(uint8(cb.level()), 2);

        // Per-address limit = 5% of 1M = 50,000 USDC
        uint256 limit = cb.getWithdrawalLimit(poolTotal);
        assertEq(limit, 50_000e6);

        // Alice (large depositor) trying to withdraw 50,000 -- should pass
        cb.checkWithdrawalAllowed(alice, 50_000e6, poolTotal, largePosition);

        // Alice trying to withdraw 50,001 -- should revert
        vm.expectRevert(
            abi.encodeWithSelector(CircuitBreaker.WithdrawalRateLimited.selector, alice, 50_000e6, 50_001e6)
        );
        cb.checkWithdrawalAllowed(alice, 50_001e6, poolTotal, largePosition);
    }

    function test_level2_minWithdrawalAmountFloor() public {
        // Small pool: 1,000 USDC. 5% = 50 USDC, but floor is 100 USDC
        uint256 poolTotal = 1_000e6;

        uint256 limit = cb.getWithdrawalLimit(poolTotal);
        assertEq(limit, 100e6); // MIN_WITHDRAWAL_AMOUNT kicks in
    }

    function test_level2_alsoBlocksBorrows() public {
        // Level 2 (Stress) >= Level 1 (Caution), so borrows are also paused
        vm.prank(recorder);
        cb.recordWithdrawal(210_000e6, 1_000_000e6);

        // Level 2 means whenBorrowingAllowed should revert (level >= 1)
        assertEq(uint8(cb.level()), 2);
        assertTrue(uint8(cb.level()) >= 1);
    }

    function test_level2_escalatesFromLevel1() public {
        // First trigger Level 1 via collateral drop
        vm.prank(recorder);
        cb.recordCollateralValue(1_000_000e6);
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);
        assertEq(uint8(cb.level()), 1);

        // Then escalate to Level 2 via withdrawal surge
        vm.prank(recorder);
        cb.recordWithdrawal(210_000e6, 1_000_000e6);

        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Stress));
    }

    function test_level2_autoRecoversWhenRateDrops() public {
        // Trigger Level 2
        vm.prank(recorder);
        cb.recordWithdrawal(210_000e6, 1_000_000e6);
        assertEq(uint8(cb.level()), 2);

        // Move to next hour bucket -- new hour has no withdrawals
        vm.warp(block.timestamp + 1 hours);

        // Record a small withdrawal (below recovery threshold of 10%)
        vm.prank(recorder);
        cb.recordWithdrawal(50_000e6, 1_000_000e6); // 5% < 10%

        // Start recovery timer. Wait 30 minutes.
        vm.warp(block.timestamp + 30 minutes);

        // Another small withdrawal to trigger recovery check
        vm.prank(recorder);
        cb.recordWithdrawal(1e6, 1_000_000e6); // negligible

        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Inactive));
    }

    function test_level2_noRecoveryWhileRateStillHigh() public {
        // Trigger Level 2
        vm.prank(recorder);
        cb.recordWithdrawal(210_000e6, 1_000_000e6);
        assertEq(uint8(cb.level()), 2);

        // Wait 30 minutes but keep withdrawing at high rate
        vm.warp(block.timestamp + 30 minutes);

        // Still in same hour bucket, total is now 210k+110k = 320k (32% > 10%)
        vm.prank(recorder);
        cb.recordWithdrawal(110_000e6, 1_000_000e6);

        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Stress));
    }

    function test_level2_tracksPerAddressWithdrawals() public {
        uint256 poolTotal = 1_000_000e6;

        // Trigger Level 2
        vm.prank(recorder);
        cb.recordWithdrawal(210_000e6, poolTotal);

        // Check alice's hourly budget
        uint256 hourBucket = block.timestamp / 1 hours;
        assertEq(cb.addressHourlyWithdrawals(alice, hourBucket), 0);

        // Note: addressHourlyWithdrawals are tracked externally by the vault when it calls
        // checkWithdrawalAllowed + records via recordWithdrawal. The CB itself tracks total volume.
    }

    function test_level2_checkWithdrawalAllowed_passesWhenNotStressed() public {
        // No Level 2 active -- should pass for any amount
        cb.checkWithdrawalAllowed(alice, 1_000_000e6, 1_000_000e6, 0);
        // No revert means pass
    }

    function test_level2_recordWithdrawal_revertsForNonRecorder() public {
        vm.prank(alice);
        vm.expectRevert();
        cb.recordWithdrawal(100e6, 1_000_000e6);
    }

    // ============================
    // Level 3: Emergency Mode
    // ============================

    function test_level3_triggersOnHighUtilisationFor30Min() public {
        // Record >95% utilisation
        vm.prank(recorder);
        cb.recordUtilisation(0.96e18); // 96%

        // Not yet triggered -- need 30 min sustained
        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Inactive));

        // Wait 30 minutes + 1 second
        vm.warp(block.timestamp + 30 minutes + 1);
        vm.prank(recorder);
        cb.recordUtilisation(0.96e18);

        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Emergency));
    }

    function test_level3_doesNotTriggerIfUtilisationDrops() public {
        vm.prank(recorder);
        cb.recordUtilisation(0.96e18);

        vm.warp(block.timestamp + 20 minutes);

        // Utilisation drops to 90% -- reset tracker
        vm.prank(recorder);
        cb.recordUtilisation(0.90e18);

        vm.warp(block.timestamp + 15 minutes);
        vm.prank(recorder);
        cb.recordUtilisation(0.96e18);

        // Only 15 min of high utilisation since drop, not 30
        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Inactive));
    }

    function test_level3_triggersOnStaleOracle() public {
        // Record oracle update from 1 hour + 1 second ago
        uint256 staleTimestamp = block.timestamp - 3601;

        vm.prank(recorder);
        cb.recordOracleTimestamp(staleTimestamp);

        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Emergency));
    }

    function test_level3_doesNotTriggerOnFreshOracle() public {
        // Oracle updated 30 minutes ago -- still fresh
        uint256 freshTimestamp = block.timestamp - 1800;

        vm.prank(recorder);
        cb.recordOracleTimestamp(freshTimestamp);

        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Inactive));
    }

    function test_level3_blocksAllExceptRepayAndLiquidate() public {
        // Trigger Emergency
        vm.prank(recorder);
        cb.recordOracleTimestamp(block.timestamp - 3601);
        assertEq(uint8(cb.level()), 3);

        // Level 3 >= 3, so whenNotPaused reverts (blocks deposits, rebalance, etc.)
        // Level 3 >= 1, so whenBorrowingAllowed reverts (blocks borrows)
        assertTrue(uint8(cb.level()) >= 3);
        assertTrue(uint8(cb.level()) >= 1);

        // USYC redemptions blocked
        assertFalse(cb.isUSYCRedemptionAllowed());
    }

    function test_level3_allowsRepayAndLiquidations() public {
        // At Level 3, repay and liquidate still work -- they don't use whenNotPaused
        // This is tested at the contract integration level, not here.
        // Just verify the level is correct.
        vm.prank(recorder);
        cb.recordOracleTimestamp(block.timestamp - 3601);
        assertEq(uint8(cb.level()), 3);
    }

    function test_level3_doesNotAutoRecover() public {
        // Trigger via oracle staleness
        vm.prank(recorder);
        cb.recordOracleTimestamp(block.timestamp - 3601);
        assertEq(uint8(cb.level()), 3);

        // Record fresh oracle and normal utilisation
        vm.warp(block.timestamp + 1 hours);
        vm.prank(recorder);
        cb.recordOracleTimestamp(block.timestamp - 100); // Fresh

        vm.prank(recorder);
        cb.recordUtilisation(0.50e18); // Normal

        // Should still be Emergency -- no auto-recovery
        assertEq(uint8(cb.level()), uint8(ICircuitBreaker.CircuitBreakerLevel.Emergency));
    }

    function test_level3_resumeRequiresAdmin() public {
        vm.prank(recorder);
        cb.recordOracleTimestamp(block.timestamp - 3601);
        assertEq(uint8(cb.level()), 3);

        // Non-admin cannot resume
        vm.prank(alice);
        vm.expectRevert();
        cb.resume();

        // Admin can resume
        vm.prank(admin);
        cb.resume();
        assertEq(uint8(cb.level()), 0);
    }

    function test_level3_resumeEmitsEvent() public {
        vm.prank(recorder);
        cb.recordOracleTimestamp(block.timestamp - 3601);

        vm.expectEmit(true, false, false, true);
        emit ICircuitBreaker.CircuitBreakerResumed(3, block.timestamp);

        vm.prank(admin);
        cb.resume();
    }

    function test_level3_escalationPath_inactiveToEmergency() public {
        // Trigger Level 1 first (collateral drop)
        vm.prank(recorder);
        cb.recordCollateralValue(1_000_000e6);
        vm.prank(recorder);
        cb.recordCollateralValue(840_000e6);
        assertEq(uint8(cb.level()), 1);

        // Escalate to Level 2 (withdrawal surge)
        vm.prank(recorder);
        cb.recordWithdrawal(210_000e6, 1_000_000e6);
        assertEq(uint8(cb.level()), 2);

        // Escalate to Level 3 (oracle stale)
        vm.prank(recorder);
        cb.recordOracleTimestamp(block.timestamp - 3601);
        assertEq(uint8(cb.level()), 3);
    }

    function test_level3_usycRedemptionAllowedAtLowerLevels() public {
        assertTrue(cb.isUSYCRedemptionAllowed()); // Inactive

        vm.prank(admin);
        cb.setLevel(1);
        assertTrue(cb.isUSYCRedemptionAllowed()); // Caution

        vm.prank(admin);
        cb.setLevel(2);
        assertTrue(cb.isUSYCRedemptionAllowed()); // Stress

        vm.prank(admin);
        cb.setLevel(3);
        assertFalse(cb.isUSYCRedemptionAllowed()); // Emergency -- blocked
    }

    function test_level3_resumeResetsUtilisationTracking() public {
        // Start high utilisation tracking
        vm.prank(recorder);
        cb.recordUtilisation(0.96e18);
        assertTrue(cb.highUtilisationStart() > 0);

        // Trigger Level 3 via oracle
        vm.prank(recorder);
        cb.recordOracleTimestamp(block.timestamp - 3601);

        // Resume
        vm.prank(admin);
        cb.resume();

        assertEq(cb.highUtilisationStart(), 0);
    }

    // ============================
    // Story 9-4: Small Depositor Protection
    // ============================

    function test_smallDepositor_exemptDuringLevel2() public {
        uint256 poolTotal = 1_000_000e6;

        // Trigger Level 2
        vm.prank(recorder);
        cb.recordWithdrawal(210_000e6, poolTotal);
        assertEq(uint8(cb.level()), 2);

        // Small depositor (500 USDC position) can withdraw their full balance
        // Even though the amount exceeds the per-address rate limit
        cb.checkWithdrawalAllowed(alice, 500e6, poolTotal, 500e6);
        // No revert -- small depositor exempted
    }

    function test_smallDepositor_exemptDuringLevel3() public {
        // Trigger Level 3
        vm.prank(recorder);
        cb.recordOracleTimestamp(block.timestamp - 3601);
        assertEq(uint8(cb.level()), 3);

        // Small depositor can still withdraw
        cb.checkWithdrawalAllowed(alice, 900e6, 1_000_000e6, 900e6);
    }

    function test_smallDepositor_largeDepositorStillRateLimited() public {
        uint256 poolTotal = 1_000_000e6;

        // Trigger Level 2
        vm.prank(recorder);
        cb.recordWithdrawal(210_000e6, poolTotal);

        // Large depositor (10,000 USDC) is still rate-limited
        // Limit = 5% of 1M = 50,000 USDC
        vm.expectRevert(
            abi.encodeWithSelector(CircuitBreaker.WithdrawalRateLimited.selector, alice, 50_000e6, 100_000e6)
        );
        cb.checkWithdrawalAllowed(alice, 100_000e6, poolTotal, 10_000e6);
    }

    function test_smallDepositor_thresholdBoundary() public {
        uint256 poolTotal = 1_000_000e6;

        // Trigger Level 2
        vm.prank(recorder);
        cb.recordWithdrawal(210_000e6, poolTotal);

        // Exactly at threshold (1000 USDC) -- should be treated as small depositor (<=)
        cb.checkWithdrawalAllowed(alice, 1000e6, poolTotal, 1000e6);

        // Just above threshold (1001 USDC) -- rate-limited
        // limit = 50k, requesting 100k
        vm.expectRevert(
            abi.encodeWithSelector(CircuitBreaker.WithdrawalRateLimited.selector, alice, 50_000e6, 100_000e6)
        );
        cb.checkWithdrawalAllowed(alice, 100_000e6, poolTotal, 1001e6);
    }

    function test_smallDepositor_thresholdConfigurableByAdmin() public {
        assertEq(cb.smallDepositorThreshold(), 1000e6);

        vm.prank(admin);
        cb.setSmallDepositorThreshold(2000e6);

        assertEq(cb.smallDepositorThreshold(), 2000e6);
    }

    function test_smallDepositor_thresholdSetterRevertsForNonAdmin() public {
        vm.prank(alice);
        vm.expectRevert();
        cb.setSmallDepositorThreshold(2000e6);
    }

    function test_smallDepositor_antiGaming_usesPreWithdrawalBalance() public {
        uint256 poolTotal = 1_000_000e6;

        // Trigger Level 2
        vm.prank(recorder);
        cb.recordWithdrawal(210_000e6, poolTotal);

        // A large depositor has 5000 USDC. Their position is checked BEFORE withdrawal.
        // positionValue = 5000e6 > threshold = 1000e6, so they are NOT exempt.
        vm.expectRevert(
            abi.encodeWithSelector(CircuitBreaker.WithdrawalRateLimited.selector, alice, 50_000e6, 100_000e6)
        );
        cb.checkWithdrawalAllowed(alice, 100_000e6, poolTotal, 5000e6);

        // Even if they try to claim their balance is small (by passing a lower positionValue),
        // the vault must pass the REAL pre-withdrawal balance. This is enforced at the
        // ChariotVault level, not in CircuitBreaker (trusted caller pattern).
    }

    function test_smallDepositor_noExemptionWhenNotStressed() public {
        // When not in Level 2/3, rate limiting is not enforced at all,
        // so the small depositor check is irrelevant
        cb.checkWithdrawalAllowed(alice, 1_000_000e6, 1_000_000e6, 500e6);
        // No revert -- no rate limiting when Inactive
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

    function testFuzz_withdrawalAmounts_noPanic(uint256 amount, uint256 poolTotal) public {
        poolTotal = bound(poolTotal, 1, type(uint128).max);
        amount = bound(amount, 0, poolTotal);

        vm.prank(recorder);
        cb.recordWithdrawal(amount, poolTotal);

        uint8 lvl = uint8(cb.level());
        assertTrue(lvl <= 3);
    }

    function testFuzz_smallDepositor_positionValues(uint256 positionValue, uint256 amount) public {
        positionValue = bound(positionValue, 0, type(uint128).max);
        amount = bound(amount, 0, type(uint128).max);

        // Trigger Level 2
        vm.prank(recorder);
        cb.recordWithdrawal(210_000e6, 1_000_000e6);

        // If positionValue <= threshold, should not revert
        if (positionValue <= cb.smallDepositorThreshold()) {
            cb.checkWithdrawalAllowed(alice, amount, 1_000_000e6, positionValue);
        }
        // If positionValue > threshold and amount > limit, should revert
        // We don't test the revert path here as it depends on specific amounts
    }
}
