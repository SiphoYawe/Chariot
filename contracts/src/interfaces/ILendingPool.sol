// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {StorkStructs} from "@stork-oracle/StorkStructs.sol";

/// @title ILendingPool -- Interface for the lending pool
interface ILendingPool {
    struct BorrowerPosition {
        uint256 principal;
        uint256 interestIndex;
        uint256 lastAccrualTimestamp;
    }

    // -- Events --
    event Borrowed(address indexed borrower, address indexed collateralToken, uint256 amount, uint256 healthFactor);
    event Repaid(address indexed borrower, uint256 amount, uint256 remainingDebt);
    event InterestAccrued(uint256 interestAmount, uint256 globalIndex, uint256 totalBorrowed);

    // -- Errors --
    error HealthFactorTooLow();
    error ExceedsLTV();
    error InsufficientLiquidity();
    error NoPosition();
    error NoDebt();

    // -- Functions --
    function borrow(
        address collateralToken,
        uint256 amount,
        StorkStructs.TemporalNumericValueInput[] calldata priceUpdates
    ) external;
    function repay(uint256 amount) external;
    function repayFull() external;
    function getUserDebt(address user) external view returns (uint256);
    function getUserPosition(address user) external view returns (BorrowerPosition memory);
    function getTotalBorrowed() external view returns (uint256);
    function getTotalReserves() external view returns (uint256);
    function getLastAccrualTimestamp() external view returns (uint256);
}
