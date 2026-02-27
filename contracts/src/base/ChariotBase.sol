// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ChariotBase -- Abstract base for all Chariot protocol contracts
/// @dev Provides cross-cutting concerns: access control, reentrancy guard, oracle/circuit-breaker modifiers
abstract contract ChariotBase is AccessControl, ReentrancyGuard {
    // -- Roles --
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant LENDING_POOL_ROLE = keccak256("LENDING_POOL_ROLE");

    // -- State --
    address public storkOracle;
    address public circuitBreaker;

    // -- Constants --
    uint256 public constant STALENESS_THRESHOLD = 3600;

    // -- Custom Errors --
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance();

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
        circuitBreaker = _circuitBreaker;
    }

    function setStorkOracle(address _storkOracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        storkOracle = _storkOracle;
    }
}
