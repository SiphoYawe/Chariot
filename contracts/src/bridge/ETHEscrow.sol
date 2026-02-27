// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IETHEscrow} from "../interfaces/IETHEscrow.sol";

/// @title ETHEscrow -- Locks ETH on Ethereum Sepolia for cross-chain bridging to Arc
/// @notice Deployed on Ethereum Sepolia. Users deposit ETH, relayer mints BridgedETH on Arc.
/// @dev Standalone contract -- no ChariotBase dependency (Sepolia, not Arc).
contract ETHEscrow is IETHEscrow, ReentrancyGuard {
    // -- Constants --
    uint256 public constant REFUND_TIMEOUT = 86400; // 24 hours

    // -- State --
    mapping(uint256 => DepositInfo) private _deposits;
    uint256 private _nonce;
    address private immutable _relayer;

    // -- Modifiers --
    modifier onlyRelayer() {
        if (msg.sender != _relayer) revert Unauthorized();
        _;
    }

    // -- Constructor --
    constructor(address relayer_) {
        if (relayer_ == address(0)) revert Unauthorized();
        _relayer = relayer_;
    }

    // -- External Functions --

    /// @notice Lock ETH in escrow for bridging to Arc
    /// @dev Increments global nonce. Emits Deposited event for relayer.
    function deposit() external payable {
        if (msg.value == 0) revert ZeroDeposit();

        uint256 nonce = _nonce;
        _deposits[nonce] = DepositInfo({
            depositor: msg.sender, amount: msg.value, timestamp: block.timestamp, status: DepositStatus.Pending
        });
        _nonce = nonce + 1;

        emit Deposited(msg.sender, msg.value, nonce);
    }

    /// @notice Refund locked ETH after timeout if bridge has not completed
    /// @param nonce The deposit nonce to refund
    function refund(uint256 nonce) external nonReentrant {
        DepositInfo storage info = _deposits[nonce];
        if (info.depositor == address(0)) revert DepositNotFound();
        if (info.status != DepositStatus.Pending) revert AlreadyProcessed();
        if (info.depositor != msg.sender) revert Unauthorized();
        if (block.timestamp < info.timestamp + REFUND_TIMEOUT) revert RefundTooEarly();

        // Effects before interactions
        info.status = DepositStatus.Refunded;
        uint256 amount = info.amount;

        emit Refunded(msg.sender, amount, nonce);

        // Interaction
        (bool success,) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    /// @notice Release locked ETH back to depositor after BridgedETH is burned on Arc
    /// @dev Only callable by the authorized relayer
    /// @param depositor The original depositor address
    /// @param amount The amount to release (must match deposit)
    /// @param nonce The deposit nonce
    function release(address depositor, uint256 amount, uint256 nonce) external nonReentrant onlyRelayer {
        DepositInfo storage info = _deposits[nonce];
        if (info.depositor == address(0)) revert DepositNotFound();
        if (info.status != DepositStatus.Pending) revert AlreadyProcessed();
        if (info.depositor != depositor) revert Unauthorized();
        if (info.amount != amount) revert Unauthorized();

        // Effects before interactions
        info.status = DepositStatus.Released;

        emit Released(depositor, amount, nonce);

        // Interaction
        (bool success,) = depositor.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    // -- View Functions --

    /// @notice Get deposit info by nonce
    function getDeposit(uint256 nonce) external view returns (DepositInfo memory) {
        return _deposits[nonce];
    }

    /// @notice Get the current global nonce (next deposit will use this nonce)
    function getCurrentNonce() external view returns (uint256) {
        return _nonce;
    }

    /// @notice Get the relayer address
    function getRelayer() external view returns (address) {
        return _relayer;
    }
}
