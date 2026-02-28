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
    event SmallDepositorExemption(address indexed user, uint256 positionValue);

    // -- View Functions --

    /// @notice Get current circuit breaker level
    function level() external view returns (CircuitBreakerLevel);

    /// @notice Get the per-address withdrawal limit during rate limiting
    /// @param poolTotal Total pool value in USDC (6 decimals)
    /// @return Maximum withdrawal amount per address per hour (6 decimals)
    function getWithdrawalLimit(uint256 poolTotal) external view returns (uint256);

    /// @notice Check if a withdrawal is allowed under rate limiting
    /// @param user The withdrawing address
    /// @param amount Amount to withdraw (6 decimals)
    /// @param poolTotal Total pool value (6 decimals)
    /// @param positionValue User's vault position value (6 decimals)
    function checkWithdrawalAllowed(address user, uint256 amount, uint256 poolTotal, uint256 positionValue)
        external
        view;

    /// @notice Check if USYC redemptions are allowed
    function isUSYCRedemptionAllowed() external view returns (bool);

    // -- State-Changing Functions --

    /// @notice Record total collateral value for monitoring -- called by CollateralManager
    /// @param totalValue Total collateral value in USDC (6 decimals)
    function recordCollateralValue(uint256 totalValue) external;

    /// @notice Record a withdrawal for volume tracking -- called by ChariotVault
    /// @param amount Withdrawal amount in USDC (6 decimals)
    /// @param poolTotal Total pool value at time of withdrawal (6 decimals)
    function recordWithdrawal(uint256 amount, uint256 poolTotal) external;

    /// @notice Record current utilisation rate -- called by LendingPool
    /// @param utilisationRate Utilisation rate in WAD (18 decimals)
    function recordUtilisation(uint256 utilisationRate) external;

    /// @notice Record oracle update timestamp -- called by oracle-consuming contracts
    /// @param lastOracleUpdate Timestamp of last oracle data
    function recordOracleTimestamp(uint256 lastOracleUpdate) external;
}
