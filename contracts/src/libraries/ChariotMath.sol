// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

/// @title ChariotMath -- WAD precision math helpers for Chariot protocol
/// @dev Wraps Solady FixedPointMathLib for protocol-specific conversions
library ChariotMath {
    uint256 internal constant WAD = 1e18;
    uint8 internal constant USDC_DECIMALS = 6;

    /// @notice Convert a token amount to WAD (18-decimal) precision
    /// @param amount The token amount in its native decimals
    /// @param decimals The token's decimal count
    /// @return The amount in WAD precision
    function toWad(uint256 amount, uint8 decimals) internal pure returns (uint256) {
        if (decimals >= 18) return amount / (10 ** (decimals - 18));
        return amount * (10 ** (18 - decimals));
    }

    /// @notice Convert a WAD amount back to a token's native decimals
    /// @param wadAmount The amount in WAD precision
    /// @param decimals The target token's decimal count
    /// @return The amount in native decimals
    function fromWad(uint256 wadAmount, uint8 decimals) internal pure returns (uint256) {
        if (decimals >= 18) return wadAmount * (10 ** (decimals - 18));
        return wadAmount / (10 ** (18 - decimals));
    }

    /// @notice Multiply two WAD values: (a * b) / WAD
    function wadMul(uint256 a, uint256 b) internal pure returns (uint256) {
        return FixedPointMathLib.mulWad(a, b);
    }

    /// @notice Divide two WAD values: (a * WAD) / b
    function wadDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return FixedPointMathLib.divWad(a, b);
    }

    /// @notice Convert USDC (6 decimals) to WAD
    function usdcToWad(uint256 usdcAmount) internal pure returns (uint256) {
        return usdcAmount * 1e12;
    }

    /// @notice Convert WAD to USDC (6 decimals)
    function wadToUsdc(uint256 wadAmount) internal pure returns (uint256) {
        return wadAmount / 1e12;
    }
}
