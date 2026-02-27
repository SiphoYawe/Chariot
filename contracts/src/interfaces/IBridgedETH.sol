// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title IBridgedETH -- Interface for the BridgedETH token on Arc Testnet
/// @notice ERC-20 representation of ETH locked in ETHEscrow on Ethereum Sepolia
interface IBridgedETH {
    // -- Events --
    event Minted(address indexed user, uint256 amount, uint256 nonce);
    event Burned(address indexed user, uint256 amount);

    // -- Errors --
    error NonceAlreadyProcessed();
    error ZeroAmount();

    // -- Functions --
    function mint(address to, uint256 amount, uint256 nonce) external;
    function burn(uint256 amount) external;
    function isNonceProcessed(uint256 nonce) external view returns (bool);
}
