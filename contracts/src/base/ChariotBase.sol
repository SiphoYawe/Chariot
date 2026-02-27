// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IStork} from "../interfaces/IStork.sol";
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

    // -- Constants --
    uint256 public constant STALENESS_THRESHOLD = 3600;

    // -- Custom Errors --
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance();
    error OracleDataStale();
    error ZeroPriceReturned();
    error OracleFeedNotConfigured();

    // -- Events --
    event OraclePriceUpdated(bytes32 indexed feedId, uint256 price, uint256 timestamp);
    event StorkOracleUpdated(address indexed oldOracle, address indexed newOracle);
    event CircuitBreakerUpdated(address indexed oldBreaker, address indexed newBreaker);

    // -- Modifiers --

    /// @dev Reverts if the circuit breaker is at Level 3 (Emergency).
    ///      Passes through when circuitBreaker is address(0) (not yet deployed).
    modifier whenNotPaused() {
        _;
    }

    /// @dev Reverts if the circuit breaker is at Level 1+ (borrowing paused).
    ///      Passes through when circuitBreaker is address(0) (not yet deployed).
    modifier whenBorrowingAllowed() {
        _;
    }

    // -- Admin Functions --

    function setCircuitBreaker(address _circuitBreaker) external onlyRole(DEFAULT_ADMIN_ROLE) {
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
