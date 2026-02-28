// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title ICircuitBreaker -- Interface for Chariot protocol circuit breaker
/// @notice Three-level protection system: Caution (pause borrows), Stress (rate-limit withdrawals), Emergency (full lockdown)
interface ICircuitBreaker {
    // -- Enums --
    enum CircuitBreakerLevel {
        Inactive, // 0: Normal operation
        Caution, // 1: Pause new borrows (collateral drop >15% in 1hr)
        Stress, // 2: Rate-limit withdrawals + pause borrows (withdrawal surge >20%/hr)
        Emergency // 3: Full lockdown -- only repayments + liquidations (utilisation >95% 30min OR oracle stale >1hr)
    }

    // -- Events --
    event CircuitBreakerTriggered(uint8 indexed level, uint256 timestamp, uint256 triggerValue);
    event CircuitBreakerResumed(uint8 indexed previousLevel, uint256 timestamp);

    // -- View Functions --

    /// @notice Get current circuit breaker level
    function level() external view returns (CircuitBreakerLevel);

    // -- State-Changing Functions --

    /// @notice Record total collateral value for monitoring -- called by CollateralManager
    /// @param totalValue Total collateral value in USDC (6 decimals)
    function recordCollateralValue(uint256 totalValue) external;
}
