// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title ICCTPBridge -- Interface for the Chariot CCTP bridge
/// @notice Enables cross-chain USDC delivery via Circle's CCTP
interface ICCTPBridge {
    // -- Structs --
    struct ChainInfo {
        uint32 domain;
        string name;
        uint256 estimatedDeliverySeconds;
        bool active;
    }

    // -- Events --
    event USDCBridged(
        address indexed sender,
        uint32 indexed destinationDomain,
        bytes32 recipient,
        uint256 amount,
        uint64 nonce
    );
    event ChainStatusUpdated(uint32 indexed domain, bool active);

    // -- Errors --
    error UnsupportedDestination();
    error ChainNotActive();
    error InsufficientUSDCBalance();
    error ApprovalFailed();

    // -- Functions --
    function bridgeUSDC(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient) external returns (uint64);
    function getSupportedChains() external view returns (ChainInfo[] memory);
    function isChainSupported(uint32 domain) external view returns (bool);
    function setChainActive(uint32 domain, bool active) external;
}
