// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ICircuitBreaker} from "../interfaces/ICircuitBreaker.sol";

/// @title CircuitBreaker -- Three-level automated protocol protection
/// @notice Standalone contract (does NOT inherit ChariotBase). Monitors collateral, withdrawal volume,
///         utilisation, and oracle freshness to automatically escalate/de-escalate protection levels.
/// @dev Level 1 (Caution): auto-triggers on >15% collateral drop in 1hr, auto-recovers after 30min stability
///      Level 2 (Stress): auto-triggers on >20% withdrawal rate in 1hr, rate-limits withdrawals to 5% pool/hr/address
contract CircuitBreaker is AccessControl, ICircuitBreaker {
    // -- Roles --
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    /// @dev Contracts that record data (CollateralManager, ChariotVault, LendingPool)
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    // -- Level 1 Constants --
    uint256 public constant COLLATERAL_DROP_THRESHOLD = 0.15e18; // 15% drop triggers Level 1
    uint256 public constant MONITORING_WINDOW = 1 hours;
    uint256 public constant RECOVERY_PERIOD = 30 minutes;

    // -- Level 2 Constants --
    uint256 public constant WITHDRAWAL_RATE_THRESHOLD = 0.20e18; // 20% of pool triggers Level 2
    uint256 public constant WITHDRAWAL_RATE_LIMIT = 0.05e18; // 5% of pool per address per hour
    uint256 public constant MIN_WITHDRAWAL_AMOUNT = 100e6; // 100 USDC floor (6 decimals)
    uint256 public constant RECOVERY_RATE_THRESHOLD = 0.10e18; // 10% -- Level 2 recovers below this

    // -- State --
    CircuitBreakerLevel public currentLevel;
    uint256 public levelActivatedAt;

    // -- Level 1: Collateral Monitoring --
    uint256 public peakCollateralValue;
    uint256 public peakTimestamp;
    uint256 public lastStableTimestamp;

    // -- Level 2: Withdrawal Volume Tracking --
    // Track total withdrawal volume using hour buckets for gas efficiency
    mapping(uint256 => uint256) public hourlyWithdrawalVolume; // hourBucket => total volume
    // Track per-address withdrawal amounts within current hour
    mapping(address => mapping(uint256 => uint256)) public addressHourlyWithdrawals;
    // Track when Level 2 withdrawal rate last dropped below recovery threshold
    uint256 public withdrawalRecoveryStart;

    // -- Custom Errors --
    error ZeroAddress();
    error InvalidLevel();
    error LevelNotEscalated(uint8 current, uint8 requested);
    error ZeroCollateralValue();
    error WithdrawalRateLimited(address user, uint256 limit, uint256 requested);

    // -- Constructor --
    constructor(address admin_) {
        if (admin_ == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(OPERATOR_ROLE, admin_);

        lastStableTimestamp = block.timestamp;
    }

    // -- View Functions --

    /// @inheritdoc ICircuitBreaker
    function level() external view override returns (CircuitBreakerLevel) {
        return currentLevel;
    }

    /// @inheritdoc ICircuitBreaker
    function getWithdrawalLimit(uint256 poolTotal) external pure override returns (uint256) {
        uint256 rateLimit = (poolTotal * WITHDRAWAL_RATE_LIMIT) / 1e18;
        return rateLimit > MIN_WITHDRAWAL_AMOUNT ? rateLimit : MIN_WITHDRAWAL_AMOUNT;
    }

    /// @inheritdoc ICircuitBreaker
    function checkWithdrawalAllowed(address user, uint256 amount, uint256 poolTotal, uint256 positionValue)
        external
        view
        override
    {
        // Only enforce rate limiting during Stress or Emergency
        if (currentLevel < CircuitBreakerLevel.Stress) return;

        // Small depositor exemption handled in Story 9-4 (positionValue param reserved)
        // For now, just enforce rate limiting for all users

        uint256 hourBucket = block.timestamp / 1 hours;
        uint256 alreadyWithdrawn = addressHourlyWithdrawals[user][hourBucket];

        uint256 limit = (poolTotal * WITHDRAWAL_RATE_LIMIT) / 1e18;
        if (limit < MIN_WITHDRAWAL_AMOUNT) limit = MIN_WITHDRAWAL_AMOUNT;

        if (alreadyWithdrawn + amount > limit) {
            revert WithdrawalRateLimited(user, limit, alreadyWithdrawn + amount);
        }
    }

    /// @inheritdoc ICircuitBreaker
    function isUSYCRedemptionAllowed() external view override returns (bool) {
        // USYC redemptions blocked during Emergency only (Story 9-3)
        return currentLevel != CircuitBreakerLevel.Emergency;
    }

    // -- Level 1: Collateral Monitoring --

    /// @inheritdoc ICircuitBreaker
    function recordCollateralValue(uint256 totalValue) external override onlyRole(RECORDER_ROLE) {
        if (totalValue == 0) revert ZeroCollateralValue();

        _updateCollateralPeak(totalValue);
        _checkCollateralDrop(totalValue);
        _checkRecovery(totalValue);
    }

    // -- Level 2: Withdrawal Volume Tracking --

    /// @inheritdoc ICircuitBreaker
    function recordWithdrawal(uint256 amount, uint256 poolTotal) external override onlyRole(RECORDER_ROLE) {
        uint256 hourBucket = block.timestamp / 1 hours;

        // Track total hourly withdrawal volume
        hourlyWithdrawalVolume[hourBucket] += amount;

        // Check for Level 2 trigger
        if (currentLevel < CircuitBreakerLevel.Stress && poolTotal > 0) {
            uint256 withdrawalRate = (hourlyWithdrawalVolume[hourBucket] * 1e18) / poolTotal;
            if (withdrawalRate > WITHDRAWAL_RATE_THRESHOLD) {
                _escalateToLevel(CircuitBreakerLevel.Stress, withdrawalRate);
            }
        }

        // Check for Level 2 auto-recovery
        _checkWithdrawalRecovery(poolTotal);
    }

    // -- Stub functions for Story 9-3 (implemented later) --

    /// @inheritdoc ICircuitBreaker
    function recordUtilisation(uint256) external override onlyRole(RECORDER_ROLE) {
        // Implemented in Story 9-3
    }

    /// @inheritdoc ICircuitBreaker
    function recordOracleTimestamp(uint256) external override onlyRole(RECORDER_ROLE) {
        // Implemented in Story 9-3
    }

    // -- Admin Functions --

    /// @notice Manual level escalation for operators (e.g., during detected attacks)
    /// @param newLevel The level to set (must be 1-3 and higher than current)
    function setLevel(uint8 newLevel) external onlyRole(OPERATOR_ROLE) {
        if (newLevel == 0 || newLevel > 3) revert InvalidLevel();
        CircuitBreakerLevel lvl = CircuitBreakerLevel(newLevel);

        if (lvl <= currentLevel) revert LevelNotEscalated(uint8(currentLevel), newLevel);

        currentLevel = lvl;
        levelActivatedAt = block.timestamp;
        emit CircuitBreakerTriggered(newLevel, block.timestamp, 0);
    }

    /// @notice Admin resume -- resets circuit breaker to Inactive (DEFAULT_ADMIN_ROLE only)
    /// @dev This is the admin escape hatch for all levels. Level 3 requires this (no auto-recovery).
    function resume() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint8 previousLevel = uint8(currentLevel);
        currentLevel = CircuitBreakerLevel.Inactive;
        levelActivatedAt = 0;
        lastStableTimestamp = block.timestamp;
        withdrawalRecoveryStart = 0;

        // Reset peak tracking
        peakCollateralValue = 0;
        peakTimestamp = 0;

        emit CircuitBreakerResumed(previousLevel, block.timestamp);
    }

    // -- Internal Functions --

    /// @dev Escalate to a higher circuit breaker level
    function _escalateToLevel(CircuitBreakerLevel newLevel, uint256 triggerValue) internal {
        if (newLevel <= currentLevel) return;
        currentLevel = newLevel;
        levelActivatedAt = block.timestamp;
        lastStableTimestamp = 0;
        emit CircuitBreakerTriggered(uint8(newLevel), block.timestamp, triggerValue);
    }

    /// @dev Update the peak collateral value within the monitoring window
    function _updateCollateralPeak(uint256 currentValue) internal {
        if (block.timestamp - peakTimestamp > MONITORING_WINDOW) {
            peakCollateralValue = currentValue;
            peakTimestamp = block.timestamp;
            return;
        }

        if (currentValue > peakCollateralValue) {
            peakCollateralValue = currentValue;
            peakTimestamp = block.timestamp;
        }
    }

    /// @dev Check if collateral has dropped beyond threshold from peak
    function _checkCollateralDrop(uint256 currentValue) internal {
        if (currentLevel >= CircuitBreakerLevel.Caution) return;
        if (peakCollateralValue == 0) return;
        if (currentValue >= peakCollateralValue) return;

        uint256 drop = ((peakCollateralValue - currentValue) * 1e18) / peakCollateralValue;

        if (drop > COLLATERAL_DROP_THRESHOLD) {
            currentLevel = CircuitBreakerLevel.Caution;
            levelActivatedAt = block.timestamp;
            lastStableTimestamp = 0;

            peakCollateralValue = currentValue;
            peakTimestamp = block.timestamp;

            emit CircuitBreakerTriggered(1, block.timestamp, drop);
        }
    }

    /// @dev Check if conditions allow auto-recovery from Level 1 (Caution)
    function _checkRecovery(uint256 currentValue) internal {
        // Only auto-recover from Level 1 (Caution)
        if (currentLevel != CircuitBreakerLevel.Caution) return;
        if (peakCollateralValue == 0) return;

        bool isStable;
        if (currentValue >= peakCollateralValue) {
            isStable = true;
        } else {
            uint256 drop = ((peakCollateralValue - currentValue) * 1e18) / peakCollateralValue;
            isStable = drop <= COLLATERAL_DROP_THRESHOLD;
        }

        if (isStable) {
            if (lastStableTimestamp == 0) {
                lastStableTimestamp = block.timestamp;
            }

            if (block.timestamp - lastStableTimestamp >= RECOVERY_PERIOD) {
                uint8 previousLevel = uint8(currentLevel);
                currentLevel = CircuitBreakerLevel.Inactive;
                levelActivatedAt = 0;
                lastStableTimestamp = block.timestamp;

                peakCollateralValue = currentValue;
                peakTimestamp = block.timestamp;

                emit CircuitBreakerResumed(previousLevel, block.timestamp);
            }
        } else {
            lastStableTimestamp = 0;
        }
    }

    /// @dev Check if Level 2 withdrawal rate has dropped below recovery threshold
    function _checkWithdrawalRecovery(uint256 poolTotal) internal {
        // Only auto-recover from Level 2 (Stress)
        if (currentLevel != CircuitBreakerLevel.Stress) return;
        if (poolTotal == 0) return;

        uint256 hourBucket = block.timestamp / 1 hours;
        uint256 currentRate = (hourlyWithdrawalVolume[hourBucket] * 1e18) / poolTotal;

        if (currentRate < RECOVERY_RATE_THRESHOLD) {
            if (withdrawalRecoveryStart == 0) {
                withdrawalRecoveryStart = block.timestamp;
            }

            if (block.timestamp - withdrawalRecoveryStart >= RECOVERY_PERIOD) {
                // Level 2 recovery: return to Level 1 if collateral conditions still warrant, else Inactive
                uint8 previousLevel = uint8(currentLevel);

                // Check if collateral conditions still warrant Level 1
                bool collateralStillStressed = false;
                if (peakCollateralValue > 0) {
                    // We don't have the current collateral value here, so go to Inactive
                    // The next recordCollateralValue will re-trigger Level 1 if needed
                    collateralStillStressed = false;
                }

                currentLevel =
                    collateralStillStressed ? CircuitBreakerLevel.Caution : CircuitBreakerLevel.Inactive;
                levelActivatedAt = 0;
                withdrawalRecoveryStart = 0;
                lastStableTimestamp = block.timestamp;

                emit CircuitBreakerResumed(previousLevel, block.timestamp);
            }
        } else {
            withdrawalRecoveryStart = 0;
        }
    }
}
