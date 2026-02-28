// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title IInterestRateModel -- Interface for the kinked utilisation rate model with volatility premium
interface IInterestRateModel {
    // -- Base rate functions --
    function getBorrowRate(uint256 utilisation) external view returns (uint256);
    function getSupplyRate(uint256 utilisation) external view returns (uint256);
    function getSupplyRateWithVolatility(uint256 utilisation, address collateralToken)
        external
        view
        returns (uint256);
    function getUtilisation(uint256 totalBorrowed, uint256 totalDeposits) external pure returns (uint256);
    function getReserveFactor() external view returns (uint256);
    function setParameters(uint256 optimalUtilisation, uint256 slope1, uint256 slope2, uint256 reserveFactor_)
        external;

    // -- Volatility premium functions (Phase 2) --
    function getVolatilityPremium(address collateralToken) external view returns (uint256);
    function getBorrowRateWithVolatility(uint256 utilisation, address collateralToken)
        external
        view
        returns (uint256);
    function getRateBreakdown(uint256 utilisation, address collateralToken)
        external
        view
        returns (uint256 baseRate, uint256 volatilityPremium, uint256 totalRate);
}
