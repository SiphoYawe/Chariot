// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IInterestRateModel} from "../interfaces/IInterestRateModel.sol";
import {IRiskParameterEngine} from "../interfaces/IRiskParameterEngine.sol";

/// @title InterestRateModel -- Kinked utilisation rate model with volatility premium
/// @notice Configurable rate parameters with admin-only setter. Uses WAD (1e18) precision.
/// @dev Parameters are mutable state variables initialized to MVP defaults.
///      Phase 2 adds volatility premium: total_rate = base_rate + vol_premium
contract InterestRateModel is IInterestRateModel, AccessControl {
    using FixedPointMathLib for uint256;

    // -- Constants --
    uint256 public constant WAD = 1e18;
    uint256 public constant BASELINE_VOLATILITY = 25e16; // 25% annualized
    uint256 public constant MAX_K_VOL = 5e18; // Max kVol = 5.0

    // -- Configurable Parameters (WAD precision) --
    uint256 public rBase; // Base rate (default: 0%)
    uint256 public rSlope1; // Slope below kink (default: 4%)
    uint256 public rSlope2; // Slope above kink (default: 75%)
    uint256 public uOptimal; // Optimal utilisation / kink point (default: 80%)
    uint256 public reserveFactor; // Protocol reserve share (default: 10%)

    // -- Volatility Premium State --
    IRiskParameterEngine private _riskParameterEngine;
    mapping(address => uint256) private _kVolCoefficients; // per-collateral k_vol in WAD

    // -- Events --
    event RateModelParametersUpdated(
        uint256 optimalUtilisation, uint256 slope1, uint256 slope2, uint256 reserveFactor
    );
    event KVolCoefficientUpdated(address indexed collateralToken, uint256 kVol);
    event RiskParameterEngineUpdated(address indexed oldEngine, address indexed newEngine);

    // -- Errors --
    error InvalidOptimalUtilisation();
    error InvalidSlope();
    error InvalidReserveFactor();
    error CollateralNotConfigured();
    error InvalidKVolCoefficient();
    error ZeroAddress();

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

    /// @notice Set the k_vol coefficient for a specific collateral token
    /// @param collateralToken The collateral token address
    /// @param kVol The volatility sensitivity coefficient in WAD (e.g., 50e16 = 0.5)
    function setKVolCoefficient(address collateralToken, uint256 kVol) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (collateralToken == address(0)) revert CollateralNotConfigured();
        if (kVol == 0 || kVol > MAX_K_VOL) revert InvalidKVolCoefficient();
        _kVolCoefficients[collateralToken] = kVol;
        emit KVolCoefficientUpdated(collateralToken, kVol);
    }

    /// @notice Wire the RiskParameterEngine dependency
    /// @param engine The RiskParameterEngine contract address
    function setRiskParameterEngine(address engine) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (engine == address(0)) revert ZeroAddress();
        address old = address(_riskParameterEngine);
        _riskParameterEngine = IRiskParameterEngine(engine);
        emit RiskParameterEngineUpdated(old, engine);
    }

    // -- Rate Calculation Functions --

    /// @notice Calculate the annualized borrow rate for a given utilisation (base rate only)
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

    /// @notice Calculate volatility premium for a collateral token
    /// @param collateralToken The collateral token address
    /// @return Premium rate in WAD (e.g., 5e16 = 5%)
    function getVolatilityPremium(address collateralToken) public view returns (uint256) {
        // No engine configured -- no premium (MVP fallback)
        if (address(_riskParameterEngine) == address(0)) return 0;

        uint256 kVol = _kVolCoefficients[collateralToken];
        // No k_vol configured for this token -- no premium
        if (kVol == 0) return 0;

        // Wrap in try/catch -- oracle failure degrades gracefully to zero premium
        try _riskParameterEngine.getCurrentVolatility(collateralToken) returns (uint256 currentVol) {
            // Vol at or below baseline -- no premium
            if (currentVol <= BASELINE_VOLATILITY) return 0;

            uint256 excess = currentVol - BASELINE_VOLATILITY;
            // premium = kVol * excess (both in WAD)
            return kVol.mulWad(excess);
        } catch {
            return 0;
        }
    }

    /// @notice Calculate total borrow rate including volatility premium
    /// @param utilisation The pool utilisation ratio in WAD
    /// @param collateralToken The primary collateral token for premium calculation
    /// @return Total borrow rate in WAD (base + premium)
    function getBorrowRateWithVolatility(uint256 utilisation, address collateralToken)
        public
        view
        returns (uint256)
    {
        uint256 baseRate = getBorrowRate(utilisation);
        uint256 premium = getVolatilityPremium(collateralToken);
        return baseRate + premium;
    }

    /// @notice Get full rate breakdown for frontend display
    /// @param utilisation The pool utilisation ratio in WAD
    /// @param collateralToken The primary collateral token
    /// @return baseRate The utilisation-based borrow rate in WAD
    /// @return volatilityPremium The volatility premium in WAD
    /// @return totalRate The total borrow rate in WAD
    function getRateBreakdown(uint256 utilisation, address collateralToken)
        external
        view
        returns (uint256 baseRate, uint256 volatilityPremium, uint256 totalRate)
    {
        baseRate = getBorrowRate(utilisation);
        volatilityPremium = getVolatilityPremium(collateralToken);
        totalRate = baseRate + volatilityPremium;
    }

    /// @notice Calculate the annualized supply rate (base rate only)
    /// @param utilisation The pool utilisation ratio in WAD
    /// @return The supply rate in WAD
    function getSupplyRate(uint256 utilisation) external view returns (uint256) {
        uint256 borrowRate = getBorrowRate(utilisation);
        // supplyRate = borrowRate * utilisation * (1 - reserveFactor)
        return borrowRate.mulWad(utilisation).mulWad(WAD - reserveFactor);
    }

    /// @notice Calculate volatility-aware supply rate
    /// @param utilisation The pool utilisation ratio in WAD
    /// @param collateralToken The primary collateral token for premium calculation
    /// @return The supply rate in WAD including volatility premium effect
    function getSupplyRateWithVolatility(uint256 utilisation, address collateralToken)
        external
        view
        returns (uint256)
    {
        uint256 borrowRate = getBorrowRateWithVolatility(utilisation, collateralToken);
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

    /// @notice Get the k_vol coefficient for a collateral token
    function getKVolCoefficient(address collateralToken) external view returns (uint256) {
        return _kVolCoefficients[collateralToken];
    }

    /// @notice Get the RiskParameterEngine address
    function getRiskParameterEngine() external view returns (address) {
        return address(_riskParameterEngine);
    }
}
