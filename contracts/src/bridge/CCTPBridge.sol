// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ICCTPBridge} from "../interfaces/ICCTPBridge.sol";
import {ITokenMessengerV2} from "../interfaces/ITokenMessengerV2.sol";

/// @title CCTPBridge -- Bridge USDC from Arc to other chains via Circle CCTP
/// @notice Wraps TokenMessengerV2 with a destination chain registry and event tracking
/// @dev Does not inherit ChariotBase -- standalone bridge contract with its own access control
contract CCTPBridge is AccessControl, ReentrancyGuard, ICCTPBridge {
    using SafeERC20 for IERC20;

    // -- Immutables --
    ITokenMessengerV2 public immutable tokenMessenger;
    IERC20 public immutable usdc;

    // -- Constants --
    uint32 public constant MIN_FINALITY_STANDARD = 2000;

    // -- State --
    uint32[] private _supportedDomains;
    mapping(uint32 => ChainInfo) private _chains;
    mapping(uint32 => bool) private _registered;

    // -- Errors --
    error ZeroAddress();
    error ZeroAmount();
    error ZeroRecipient();
    error DomainAlreadyRegistered();

    // -- Constructor --
    constructor(address tokenMessenger_, address usdc_, address admin_) {
        if (tokenMessenger_ == address(0) || usdc_ == address(0) || admin_ == address(0)) {
            revert ZeroAddress();
        }

        tokenMessenger = ITokenMessengerV2(tokenMessenger_);
        usdc = IERC20(usdc_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);

        // Register default supported chains
        _registerChain(0, "Ethereum", 1140); // ~19 minutes standard finality
        _registerChain(3, "Arbitrum", 1140); // ~19 minutes standard finality
        _registerChain(6, "Base", 1140); // ~19 minutes standard finality
    }

    // -- External Functions --

    /// @notice Bridge USDC from Arc to a supported destination chain via CCTP
    /// @param amount Amount of USDC to bridge (6 decimals)
    /// @param destinationDomain CCTP domain ID of destination chain
    /// @param mintRecipient Recipient address on destination chain (bytes32, left-padded)
    /// @return nonce The CCTP message nonce for attestation tracking
    function bridgeUSDC(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient)
        external
        nonReentrant
        returns (uint64)
    {
        if (amount == 0) revert ZeroAmount();
        if (mintRecipient == bytes32(0)) revert ZeroRecipient();
        if (!_isRegistered(destinationDomain)) revert UnsupportedDestination();
        if (!_chains[destinationDomain].active) revert ChainNotActive();

        // Transfer USDC from sender to this contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Approve TokenMessengerV2 to spend USDC
        usdc.forceApprove(address(tokenMessenger), amount);

        // Call depositForBurn on TokenMessengerV2
        uint64 nonce = tokenMessenger.depositForBurn(
            amount,
            destinationDomain,
            mintRecipient,
            address(usdc),
            bytes32(0), // Any caller can receive on destination
            0, // No fee cap (standard transfer)
            MIN_FINALITY_STANDARD
        );

        emit USDCBridged(msg.sender, destinationDomain, mintRecipient, amount, nonce);

        return nonce;
    }

    /// @notice Get all supported destination chains
    /// @return Array of ChainInfo structs
    function getSupportedChains() external view returns (ChainInfo[] memory) {
        ChainInfo[] memory chains = new ChainInfo[](_supportedDomains.length);
        for (uint256 i = 0; i < _supportedDomains.length; i++) {
            chains[i] = _chains[_supportedDomains[i]];
        }
        return chains;
    }

    /// @notice Check if a destination domain is supported and active
    /// @param domain CCTP domain ID
    /// @return True if domain is supported and active
    function isChainSupported(uint32 domain) external view returns (bool) {
        return _chains[domain].active;
    }

    // -- Admin Functions --

    /// @notice Enable or disable a destination chain
    /// @param domain CCTP domain ID
    /// @param active Whether the chain should be active
    function setChainActive(uint32 domain, bool active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!_isRegistered(domain)) revert UnsupportedDestination();
        _chains[domain].active = active;
        emit ChainStatusUpdated(domain, active);
    }

    /// @notice Register a new supported destination chain
    /// @param domain CCTP domain ID
    /// @param name Human-readable chain name
    /// @param estimatedDeliverySeconds Estimated delivery time in seconds
    function registerChain(uint32 domain, string calldata name, uint256 estimatedDeliverySeconds)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _registerChain(domain, name, estimatedDeliverySeconds);
    }

    // -- Internal Functions --

    function _registerChain(uint32 domain, string memory name, uint256 estimatedDeliverySeconds) internal {
        if (_registered[domain]) revert DomainAlreadyRegistered();

        _chains[domain] = ChainInfo({domain: domain, name: name, estimatedDeliverySeconds: estimatedDeliverySeconds, active: true});
        _registered[domain] = true;
        _supportedDomains.push(domain);
    }

    function _isRegistered(uint32 domain) internal view returns (bool) {
        return _registered[domain];
    }
}
