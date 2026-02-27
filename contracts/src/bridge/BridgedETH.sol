// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IBridgedETH} from "../interfaces/IBridgedETH.sol";

/// @title BridgedETH -- ERC-20 representation of ETH locked on Ethereum Sepolia
/// @notice Deployed on Arc Testnet. Minted by relayer when ETH is deposited, burned to release ETH.
/// @dev Uses AccessControl for MINTER_ROLE. 18 decimals (standard ETH representation).
contract BridgedETH is ERC20, AccessControl, IBridgedETH {
    // -- Roles --
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // -- State --
    mapping(uint256 => bool) private _processedNonces;

    // -- Constructor --
    constructor(address admin, address minter) ERC20("Bridged ETH", "bETH") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
    }

    // -- External Functions --

    /// @notice Mint BridgedETH to a user after ETH is locked in ETHEscrow
    /// @param to Recipient address (the original depositor)
    /// @param amount Amount of BridgedETH to mint (matches ETH locked)
    /// @param nonce ETHEscrow deposit nonce for replay protection
    function mint(address to, uint256 amount, uint256 nonce) external onlyRole(MINTER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        if (_processedNonces[nonce]) revert NonceAlreadyProcessed();

        // Effects before interactions
        _processedNonces[nonce] = true;
        _mint(to, amount);

        emit Minted(to, amount, nonce);
    }

    /// @notice Burn BridgedETH to trigger ETH release on Ethereum
    /// @param amount Amount of BridgedETH to burn
    function burn(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _burn(msg.sender, amount);

        emit Burned(msg.sender, amount);
    }

    /// @notice Check if a nonce has been processed
    /// @param nonce The nonce to check
    /// @return True if the nonce has been processed
    function isNonceProcessed(uint256 nonce) external view returns (bool) {
        return _processedNonces[nonce];
    }

    /// @dev Required override for AccessControl + ERC20 supportsInterface
    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
