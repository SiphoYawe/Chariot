// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {StorkStructs} from "@stork-oracle/StorkStructs.sol";

/// @title ILiquidationEngine -- Interface for the liquidation engine
interface ILiquidationEngine {
    // -- Events --
    event PositionLiquidated(
        address indexed borrower,
        address indexed liquidator,
        address indexed collateralToken,
        uint256 debtRepaid,
        uint256 collateralSeized,
        uint256 liquidationBonus
    );

    event LiquidationBonusParamsUpdated(uint256 baseBps, uint256 maxDepthBps, uint256 scalingFactor);

    // -- Errors --
    // Note: ZeroAmount() inherited from ChariotBase
    error PositionNotLiquidatable();
    error ExceedsMaxLiquidation();
    error InsufficientCollateralForSeizure();
    error InvalidCollateralToken();
    error SelfLiquidation();
    error StalePriceData();
    error InvalidBonusParams();

    // -- Functions --
    function liquidate(
        address borrower,
        address collateralToken,
        uint256 debtToRepay,
        StorkStructs.TemporalNumericValueInput[] calldata priceUpdates
    ) external;

    function calculateLiquidationBonus(uint256 healthFactor) external view returns (uint256);
    function getLiquidationBonus(address collateralToken) external view returns (uint256);
    function getLiquidationThreshold(address collateralToken) external view returns (uint256);
    function isLiquidatable(address borrower) external view returns (bool);
    function calculateSeizableCollateral(uint256 debtToRepayWad, uint256 collateralPrice, uint256 liquidationBonus)
        external
        pure
        returns (uint256);
}
