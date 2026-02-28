// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ICircuitBreaker} from "../interfaces/ICircuitBreaker.sol";

/// @title CircuitBreaker -- Three-level automated protocol protection
/// @notice Standalone contract (does NOT inherit ChariotBase). Monitors collateral, withdrawal volume,
///         utilisation, and oracle freshness to automatically escalate/de-escalate protection levels.
/// @dev Level 1 (Caution): auto-triggers on >15% collateral drop in 1hr, auto-recovers after 30min stability
contract CircuitBreaker is AccessControl, ICircuitBreaker {
    // -- Roles --
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    /// @dev Contracts that record data (CollateralManager, ChariotVault, LendingPool)
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    // -- Level 1 Constants --
    uint256 public constant COLLATERAL_DROP_THRESHOLD = 0.15e18; // 15% drop triggers Level 1
    uint256 public constant MONITORING_WINDOW = 1 hours;
    uint256 public constant RECOVERY_PERIOD = 30 minutes;

    // -- State --
    CircuitBreakerLevel public currentLevel;
    uint256 public levelActivatedAt;

    // -- Level 1: Collateral Monitoring --
    // Gas-efficient peak-tracking instead of circular buffer:
    // Track the peak collateral value in the current monitoring window.
    // If collateral drops >15% from peak within the window, trigger Level 1.
    uint256 public peakCollateralValue;
    uint256 public peakTimestamp;
    uint256 public lastStableTimestamp;

    // -- Custom Errors --
    error ZeroAddress();
    error InvalidLevel();
    error LevelNotEscalated(uint8 current, uint8 requested);
    error ZeroCollateralValue();

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

    // -- Level 1: Collateral Monitoring --

    /// @inheritdoc ICircuitBreaker
    function recordCollateralValue(uint256 totalValue) external override onlyRole(RECORDER_ROLE) {
        // Reject zero values -- a collateral wipeout must be handled explicitly
        if (totalValue == 0) revert ZeroCollateralValue();

        // Update peak tracking
        _updateCollateralPeak(totalValue);

        // Check for Level 1 trigger
        _checkCollateralDrop(totalValue);

        // Check for auto-recovery from Level 1
        _checkRecovery(totalValue);
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

        // Reset peak tracking
        peakCollateralValue = 0;
        peakTimestamp = 0;

        emit CircuitBreakerResumed(previousLevel, block.timestamp);
    }

    // -- Internal Functions --

    /// @dev Update the peak collateral value within the monitoring window
    /// @param currentValue Current total collateral value
    function _updateCollateralPeak(uint256 currentValue) internal {
        // If peak is outside the monitoring window, reset it
        if (block.timestamp - peakTimestamp > MONITORING_WINDOW) {
            peakCollateralValue = currentValue;
            peakTimestamp = block.timestamp;
            return;
        }

        // Update peak if current value is higher
        if (currentValue > peakCollateralValue) {
            peakCollateralValue = currentValue;
            peakTimestamp = block.timestamp;
        }
    }

    /// @dev Check if collateral has dropped beyond threshold from peak
    /// @param currentValue Current total collateral value
    function _checkCollateralDrop(uint256 currentValue) internal {
        // Only trigger Level 1 if currently Inactive
        if (currentLevel >= CircuitBreakerLevel.Caution) return;

        // Need a peak to compare against
        if (peakCollateralValue == 0) return;

        // Calculate percentage drop from peak
        if (currentValue >= peakCollateralValue) return;

        uint256 drop = ((peakCollateralValue - currentValue) * 1e18) / peakCollateralValue;

        if (drop > COLLATERAL_DROP_THRESHOLD) {
            currentLevel = CircuitBreakerLevel.Caution;
            levelActivatedAt = block.timestamp;
            lastStableTimestamp = 0; // Reset stability tracking

            // Reset peak to current value so recovery tracks stability from this new baseline
            peakCollateralValue = currentValue;
            peakTimestamp = block.timestamp;

            emit CircuitBreakerTriggered(1, block.timestamp, drop);
        }
    }

    /// @dev Check if conditions allow auto-recovery from Level 1 (Caution)
    /// @param currentValue Current total collateral value
    function _checkRecovery(uint256 currentValue) internal {
        // Only auto-recover from Level 1 (Caution)
        if (currentLevel != CircuitBreakerLevel.Caution) return;

        // Check if collateral is within safe range (not dropping from peak)
        if (peakCollateralValue == 0) return;

        bool isStable;
        if (currentValue >= peakCollateralValue) {
            isStable = true;
        } else {
            uint256 drop = ((peakCollateralValue - currentValue) * 1e18) / peakCollateralValue;
            isStable = drop <= COLLATERAL_DROP_THRESHOLD;
        }

        if (isStable) {
            // Start or continue stability tracking
            if (lastStableTimestamp == 0) {
                lastStableTimestamp = block.timestamp;
            }

            // Check if stable for long enough
            if (block.timestamp - lastStableTimestamp >= RECOVERY_PERIOD) {
                uint8 previousLevel = uint8(currentLevel);
                currentLevel = CircuitBreakerLevel.Inactive;
                levelActivatedAt = 0;
                lastStableTimestamp = block.timestamp;

                // Reset peak to current value after recovery
                peakCollateralValue = currentValue;
                peakTimestamp = block.timestamp;

                emit CircuitBreakerResumed(previousLevel, block.timestamp);
            }
        } else {
            // Not stable -- reset timer
            lastStableTimestamp = 0;
        }
    }
}
