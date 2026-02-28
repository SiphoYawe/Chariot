// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title ITokenMessengerV2 -- Circle CCTP TokenMessengerV2 interface
/// @notice Minimal interface for cross-chain USDC transfers via CCTP
interface ITokenMessengerV2 {
    /// @notice Deposit and burn tokens for cross-chain transfer
    /// @param amount Amount of tokens to burn
    /// @param destinationDomain CCTP domain ID of destination chain
    /// @param mintRecipient Address on destination chain (bytes32, left-padded)
    /// @param burnToken Address of token to burn on source chain
    /// @param destinationCaller Address allowed to call receiveMessage on destination (bytes32(0) for any)
    /// @param maxFee Maximum fee in units of burnToken
    /// @param minFinalityThreshold Minimum finality level (1000=fast, 2000=standard)
    /// @return nonce The unique nonce for this burn message
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external returns (uint64 nonce);
}
