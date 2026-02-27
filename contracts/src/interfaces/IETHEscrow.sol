// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title IETHEscrow -- Interface for the ETH escrow contract on Ethereum Sepolia
/// @notice Locks ETH for cross-chain bridging to Arc as BridgedETH collateral
interface IETHEscrow {
    enum DepositStatus {
        Pending,
        Released,
        Refunded
    }

    struct DepositInfo {
        address depositor;
        uint256 amount;
        uint256 timestamp;
        DepositStatus status;
    }

    // -- Events --
    event Deposited(address indexed depositor, uint256 amount, uint256 nonce);
    event Released(address indexed depositor, uint256 amount, uint256 nonce);
    event Refunded(address indexed depositor, uint256 amount, uint256 nonce);

    // -- Errors --
    error DepositNotFound();
    error RefundTooEarly();
    error AlreadyProcessed();
    error Unauthorized();
    error ZeroDeposit();
    error TransferFailed();

    // -- Functions --
    function deposit() external payable;
    function refund(uint256 nonce) external;
    function release(address depositor, uint256 amount, uint256 nonce) external;
    function getDeposit(uint256 nonce) external view returns (DepositInfo memory);
    function getCurrentNonce() external view returns (uint256);
    function REFUND_TIMEOUT() external view returns (uint256);
}
