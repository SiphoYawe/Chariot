// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title IInterestRateModel -- Interface for the kinked utilisation rate model
interface IInterestRateModel {
    function getBorrowRate(uint256 utilisation) external pure returns (uint256);
    function getSupplyRate(uint256 utilisation) external pure returns (uint256);
    function getUtilisation(uint256 totalBorrowed, uint256 totalDeposits) external pure returns (uint256);
    function getReserveFactor() external pure returns (uint256);
}
