// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {IInterestRateModel} from "../interfaces/IInterestRateModel.sol";

/// @title InterestRateModel -- Kinked utilisation rate model for borrowing
/// @notice Pure calculation contract -- no state, no inheritance, no oracle
/// @dev Rate model: linear below 80% kink, steep above. Uses WAD (1e18) precision.
contract InterestRateModel is IInterestRateModel {
    using FixedPointMathLib for uint256;

    // -- Constants (WAD precision) --
    uint256 public constant WAD = 1e18;
    uint256 public constant R_BASE = 0; // 0% base rate
    uint256 public constant R_SLOPE1 = 0.04e18; // 4% slope below kink
    uint256 public constant R_SLOPE2 = 0.75e18; // 75% slope above kink
    uint256 public constant U_OPTIMAL = 0.8e18; // 80% optimal utilisation (kink point)
    uint256 public constant RESERVE_FACTOR = 0.1e18; // 10% protocol reserve

    /// @notice Calculate the annualized borrow rate for a given utilisation
    /// @param utilisation The pool utilisation ratio in WAD (0 to 1e18)
    /// @return The borrow rate in WAD (e.g., 0.04e18 = 4%)
    function getBorrowRate(uint256 utilisation) public pure returns (uint256) {
        // Cap at 100%
        if (utilisation > WAD) utilisation = WAD;
        if (utilisation == 0) return R_BASE;

        if (utilisation <= U_OPTIMAL) {
            // Below kink: R_BASE + R_SLOPE1 * (U / U_OPTIMAL)
            return R_BASE + R_SLOPE1.mulWad(utilisation.divWad(U_OPTIMAL));
        }

        // Above kink: R_BASE + R_SLOPE1 + R_SLOPE2 * ((U - U_OPTIMAL) / (WAD - U_OPTIMAL))
        uint256 excessUtilisation = utilisation - U_OPTIMAL;
        uint256 maxExcess = WAD - U_OPTIMAL;
        return R_BASE + R_SLOPE1 + R_SLOPE2.mulWad(excessUtilisation.divWad(maxExcess));
    }

    /// @notice Calculate the annualized supply rate
    /// @param utilisation The pool utilisation ratio in WAD
    /// @return The supply rate in WAD
    function getSupplyRate(uint256 utilisation) external pure returns (uint256) {
        uint256 borrowRate = getBorrowRate(utilisation);
        // supplyRate = borrowRate * utilisation * (1 - reserveFactor)
        return borrowRate.mulWad(utilisation).mulWad(WAD - RESERVE_FACTOR);
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
    /// @return Reserve factor in WAD (0.1e18 = 10%)
    function getReserveFactor() external pure returns (uint256) {
        return RESERVE_FACTOR;
    }
}
