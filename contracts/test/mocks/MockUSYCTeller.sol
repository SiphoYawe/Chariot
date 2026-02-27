// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IUSYCTeller} from "../../src/interfaces/IUSYCTeller.sol";
import {MockERC20} from "./MockERC20.sol";

/// @title MockUSYCTeller -- Mock USYC Teller for testing deposit/redeem flows
/// @dev Simulates USYC appreciation via a configurable price per token
contract MockUSYCTeller is IUSYCTeller {
    IERC20 public usdc;
    MockERC20 public usyc;

    /// @notice USYC price in USDC terms, scaled to 18 decimals (WAD).
    ///         1e18 = 1 USYC is worth 1 USDC. Increases over time to simulate appreciation.
    uint256 public pricePerToken;

    constructor(address _usdc, address _usyc, uint256 _initialPrice) {
        usdc = IERC20(_usdc);
        usyc = MockERC20(_usyc);
        pricePerToken = _initialPrice;
    }

    /// @notice Update the USYC price (simulates appreciation)
    function setPrice(uint256 _newPrice) external {
        pricePerToken = _newPrice;
    }

    function deposit(uint256 usdcAmount) external override returns (uint256 usycReceived) {
        usycReceived = previewDeposit(usdcAmount);
        usdc.transferFrom(msg.sender, address(this), usdcAmount);
        usyc.mint(msg.sender, usycReceived);
    }

    function redeem(uint256 usycAmount) external override returns (uint256 usdcReceived) {
        usdcReceived = previewRedeem(usycAmount);
        usyc.transferFrom(msg.sender, address(this), usycAmount);
        usdc.transfer(msg.sender, usdcReceived);
    }

    /// @notice Preview USDC from redeeming USYC: usycAmount * pricePerToken / 1e18, then convert to 6 decimals
    function previewRedeem(uint256 usycAmount) public view override returns (uint256) {
        // usycAmount is in USYC decimals (6), pricePerToken is in WAD (18 decimals)
        // result = usycAmount * pricePerToken / 1e18 (stays in 6 decimals)
        return (usycAmount * pricePerToken) / 1e18;
    }

    /// @notice Preview USYC from depositing USDC: usdcAmount * 1e18 / pricePerToken
    function previewDeposit(uint256 usdcAmount) public view override returns (uint256) {
        // usdcAmount is in 6 decimals, result should be in 6 decimals (USYC)
        return (usdcAmount * 1e18) / pricePerToken;
    }
}
