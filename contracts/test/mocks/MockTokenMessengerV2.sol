// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITokenMessengerV2} from "../../src/interfaces/ITokenMessengerV2.sol";

/// @title MockTokenMessengerV2 -- Mock for Circle CCTP TokenMessengerV2
/// @dev Burns USDC from caller and increments nonce. Does not actually perform cross-chain transfer.
contract MockTokenMessengerV2 is ITokenMessengerV2 {
    uint64 private _nonce;
    IERC20 public usdc;

    // Track calls for test assertions
    uint256 public lastAmount;
    uint32 public lastDestinationDomain;
    bytes32 public lastMintRecipient;
    uint256 public callCount;

    constructor(address usdc_) {
        usdc = IERC20(usdc_);
    }

    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32, // destinationCaller
        uint256, // maxFee
        uint32 // minFinalityThreshold
    ) external returns (uint64 nonce) {
        // Transfer USDC from caller (CCTPBridge) to this contract (simulating burn)
        IERC20(burnToken).transferFrom(msg.sender, address(this), amount);

        // Track call data
        lastAmount = amount;
        lastDestinationDomain = destinationDomain;
        lastMintRecipient = mintRecipient;
        callCount++;

        nonce = _nonce++;
        return nonce;
    }
}
