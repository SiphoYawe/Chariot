// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IStork} from "../interfaces/IStork.sol";
import {ICircuitBreaker} from "../interfaces/ICircuitBreaker.sol";
import {StorkStructs} from "@stork-oracle/StorkStructs.sol";

/// @title ChariotBase -- Abstract base for all Chariot protocol contracts
/// @dev Provides cross-cutting concerns: access control, reentrancy guard, oracle/circuit-breaker modifiers
abstract contract ChariotBase is AccessControl, ReentrancyGuard {
    // -- Roles --
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant LENDING_POOL_ROLE = keccak256("LENDING_POOL_ROLE");
    bytes32 public constant LIQUIDATION_ENGINE_ROLE = keccak256("LIQUIDATION_ENGINE_ROLE");

    // -- State --
    address public storkOracle;
    address public circuitBreaker;
    uint8 public circuitBreakerLevel; // 0=normal, 1=pause borrows, 2=rate-limit, 3=emergency

    // -- Constants --
    uint256 public constant STALENESS_THRESHOLD = 3600;

    // -- Custom Errors --
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance();
    error OracleDataStale();
    error ZeroPriceReturned();
    error OracleFeedNotConfigured();
    error InvalidCircuitBreakerLevel();
    error CircuitBreakerActive();
    error BorrowingPaused();

    // -- Events --
    /// @dev Reserved for future use -- oracle price updates are sourced from the Stork oracle contract directly.
    ///      Not emitted by Chariot contracts in MVP; will be activated when custom oracle adapter is introduced.
    event OraclePriceUpdated(bytes32 indexed feedId, uint256 price, uint256 timestamp);
    event StorkOracleUpdated(address indexed oldOracle, address indexed newOracle);
    event CircuitBreakerUpdated(address indexed oldBreaker, address indexed newBreaker);
    event CircuitBreakerTriggered(uint8 level, address indexed triggeredBy);
    event CircuitBreakerResumed(address indexed resumedBy);

    // -- Modifiers --

    /// @dev Reverts if the circuit breaker is at Level 3 (Emergency).
    modifier whenNotPaused() {
        if (_getEffectiveCircuitBreakerLevel() >= 3) revert CircuitBreakerActive();
        _;
    }

    /// @dev Reverts if the circuit breaker is at Level 1+ (borrowing paused).
    modifier whenBorrowingAllowed() {
        if (_getEffectiveCircuitBreakerLevel() >= 1) revert BorrowingPaused();
        _;
    }

    // -- Admin Functions --

    function setCircuitBreaker(address _circuitBreaker) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_circuitBreaker == address(0)) revert ZeroAddress();
        address old = circuitBreaker;
        circuitBreaker = _circuitBreaker;
        emit CircuitBreakerUpdated(old, _circuitBreaker);
    }

    function setStorkOracle(address _storkOracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_storkOracle == address(0)) revert ZeroAddress();
        address old = storkOracle;
        storkOracle = _storkOracle;
        emit StorkOracleUpdated(old, _storkOracle);
    }

    /// @notice Trigger circuit breaker to specified level (OPERATOR_ROLE)
    /// @param level Circuit breaker level: 1=pause borrows, 2=rate-limit withdrawals, 3=emergency
    function triggerCircuitBreaker(uint8 level) external onlyRole(OPERATOR_ROLE) {
        if (level == 0 || level > 3) revert InvalidCircuitBreakerLevel();
        circuitBreakerLevel = level;
        emit CircuitBreakerTriggered(level, msg.sender);
    }

    /// @notice Resume normal protocol operation (ADMIN_ROLE only)
    function resumeCircuitBreaker() external onlyRole(DEFAULT_ADMIN_ROLE) {
        circuitBreakerLevel = 0;
        emit CircuitBreakerResumed(msg.sender);
    }

    // -- Circuit Breaker Helpers --

    /// @dev Get the effective circuit breaker level -- returns the higher of external CB and local state.
    ///      If external CB contract is set and reachable, uses max(external, local).
    ///      Falls back to local state on external call failure (prevents protocol bricking).
    function _getEffectiveCircuitBreakerLevel() internal view returns (uint8) {
        uint8 localLevel = circuitBreakerLevel;

        if (circuitBreaker != address(0)) {
            try ICircuitBreaker(circuitBreaker).level() returns (ICircuitBreaker.CircuitBreakerLevel externalLevel) {
                uint8 extLevel = uint8(externalLevel);
                return extLevel > localLevel ? extLevel : localLevel;
            } catch {
                // External CB unreachable -- fall back to local state
                return localLevel;
            }
        }

        return localLevel;
    }

    // -- Oracle Helpers --

    /// @dev Update oracle prices via Stork pull-oracle pattern
    function _updateOraclePrice(StorkStructs.TemporalNumericValueInput[] calldata priceUpdates) internal {
        if (storkOracle != address(0) && priceUpdates.length > 0) {
            IStork(storkOracle).updateTemporalNumericValuesV1(priceUpdates);
        }
    }

    /// @dev Get validated price from Stork oracle -- reverts on stale/zero/unconfigured
    function _getValidatedPrice(bytes32 feedId) internal view returns (uint256 price, uint256 timestamp) {
        if (storkOracle == address(0)) revert OracleFeedNotConfigured();
        if (feedId == bytes32(0)) revert OracleFeedNotConfigured();

        StorkStructs.TemporalNumericValue memory value = IStork(storkOracle).getTemporalNumericValueV1(feedId);
        timestamp = uint256(value.timestampNs) / 1e9;

        if (block.timestamp - timestamp > STALENESS_THRESHOLD) revert OracleDataStale();

        price = uint256(uint192(value.quantizedValue));
        if (price == 0) revert ZeroPriceReturned();
    }
}
