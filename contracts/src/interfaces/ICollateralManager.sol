// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {StorkStructs} from "@stork-oracle/StorkStructs.sol";

/// @title ICollateralManager -- Interface for collateral deposit and withdrawal
interface ICollateralManager {
    // -- Events --
    event CollateralDeposited(address indexed user, address indexed token, uint256 amount);
    event CollateralWithdrawn(address indexed user, address indexed token, uint256 amount);
    event CollateralSeized(
        address indexed borrower, address indexed liquidator, address indexed token, uint256 amount
    );

    // -- Errors --
    error DebtOutstanding();
    error InsufficientCollateral();
    error InvalidToken();

    // -- Functions --
    function depositCollateral(address token, uint256 amount) external;
    function withdrawCollateral(address token, uint256 amount) external;
    function getCollateralBalance(address user, address token) external view returns (uint256);
    function getCollateralValue(address user, StorkStructs.TemporalNumericValueInput[] calldata priceUpdates)
        external
        returns (uint256);
    function getCollateralValueView(address user) external view returns (uint256);
    function getHealthFactor(address user, StorkStructs.TemporalNumericValueInput[] calldata priceUpdates)
        external
        returns (uint256);
    function getEffectiveLTV() external view returns (uint256);
    function getLiquidationThreshold() external view returns (uint256);
    function getETHPrice() external view returns (uint256);
    function seizeCollateral(address borrower, address token, uint256 amount, address recipient) external;
}
