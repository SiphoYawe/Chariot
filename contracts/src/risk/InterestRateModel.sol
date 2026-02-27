// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IInterestRateModel} from "../interfaces/IInterestRateModel.sol";

/// @title InterestRateModel -- Kinked utilisation rate model for borrowing
/// @notice Configurable rate parameters with admin-only setter. Uses WAD (1e18) precision.
/// @dev Parameters are mutable state variables initialized to MVP defaults.
contract InterestRateModel is IInterestRateModel, AccessControl {
    using FixedPointMathLib for uint256;

    // -- Constants --
    uint256 public constant WAD = 1e18;

    // -- Configurable Parameters (WAD precision) --
    uint256 public rBase; // Base rate (default: 0%)
    uint256 public rSlope1; // Slope below kink (default: 4%)
    uint256 public rSlope2; // Slope above kink (default: 75%)
    uint256 public uOptimal; // Optimal utilisation / kink point (default: 80%)
    uint256 public reserveFactor; // Protocol reserve share (default: 10%)

    // -- Events --
    event RateModelParametersUpdated(
        uint256 optimalUtilisation, uint256 slope1, uint256 slope2, uint256 reserveFactor
    );

    // -- Errors --
    error InvalidOptimalUtilisation();
    error InvalidSlope();
    error InvalidReserveFactor();

    // -- Constructor --
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // MVP defaults
        rBase = 0;
        rSlope1 = 0.04e18; // 4%
        rSlope2 = 0.75e18; // 75%
        uOptimal = 0.8e18; // 80%
        reserveFactor = 0.1e18; // 10%
    }

    // -- Admin Functions --

    /// @notice Update rate model parameters
    /// @param optimalUtilisation_ Kink point in WAD (must be > 0 and <= 100%)
    /// @param slope1_ Rate slope below kink in WAD (must be > 0)
    /// @param slope2_ Rate slope above kink in WAD (must be > 0)
    /// @param reserveFactor_ Protocol reserve factor in WAD (must be < 100%)
    function setParameters(
        uint256 optimalUtilisation_,
        uint256 slope1_,
        uint256 slope2_,
        uint256 reserveFactor_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (optimalUtilisation_ == 0 || optimalUtilisation_ > WAD) revert InvalidOptimalUtilisation();
        if (slope1_ == 0) revert InvalidSlope();
        if (slope2_ == 0) revert InvalidSlope();
        if (reserveFactor_ >= WAD) revert InvalidReserveFactor();

        uOptimal = optimalUtilisation_;
        rSlope1 = slope1_;
        rSlope2 = slope2_;
        reserveFactor = reserveFactor_;

        emit RateModelParametersUpdated(optimalUtilisation_, slope1_, slope2_, reserveFactor_);
    }

    // -- Rate Calculation Functions --

    /// @notice Calculate the annualized borrow rate for a given utilisation
    /// @param utilisation The pool utilisation ratio in WAD (0 to 1e18)
    /// @return The borrow rate in WAD (e.g., 0.04e18 = 4%)
    function getBorrowRate(uint256 utilisation) public view returns (uint256) {
        // Cap at 100%
        if (utilisation > WAD) utilisation = WAD;
        if (utilisation == 0) return rBase;

        if (utilisation <= uOptimal) {
            // Below kink: rBase + rSlope1 * (U / uOptimal)
            return rBase + rSlope1.mulWad(utilisation.divWad(uOptimal));
        }

        // Above kink: rBase + rSlope1 + rSlope2 * ((U - uOptimal) / (WAD - uOptimal))
        uint256 excessUtilisation = utilisation - uOptimal;
        uint256 maxExcess = WAD - uOptimal;
        return rBase + rSlope1 + rSlope2.mulWad(excessUtilisation.divWad(maxExcess));
    }

    /// @notice Calculate the annualized supply rate
    /// @param utilisation The pool utilisation ratio in WAD
    /// @return The supply rate in WAD
    function getSupplyRate(uint256 utilisation) external view returns (uint256) {
        uint256 borrowRate = getBorrowRate(utilisation);
        // supplyRate = borrowRate * utilisation * (1 - reserveFactor)
        return borrowRate.mulWad(utilisation).mulWad(WAD - reserveFactor);
    }

    /// @notice Calculate pool utilisation ratio
    /// @param totalBorrowed Total amount borrowed in any denomination
    /// @param totalDeposits Total deposits in the same denomination
    /// @return Utilisation ratio in WAD (capped at 1e18)
    function getUtilisation(uint256 totalBorrowed, uint256 totalDeposits) external pure returns (uint256) {
        if (totalDeposits == 0) return 0;
        uint256 util = totalBorrowed.divWad(totalDeposits);
        return util > WAD ? WAD : util;
    }

    /// @notice Get the protocol reserve factor
    /// @return Reserve factor in WAD (e.g., 0.1e18 = 10%)
    function getReserveFactor() external view returns (uint256) {
        return reserveFactor;
    }
}
