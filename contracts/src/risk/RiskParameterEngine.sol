// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ChariotBase} from "../base/ChariotBase.sol";
import {IRiskParameterEngine} from "../interfaces/IRiskParameterEngine.sol";
import {IStork} from "../interfaces/IStork.sol";
import {StorkStructs} from "@stork-oracle/StorkStructs.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

/// @title RiskParameterEngine -- Dynamic LTV and liquidation threshold from volatility feeds
/// @notice Pure calculation engine: reads oracle data, computes risk parameters on-the-fly
/// @dev Extends ChariotBase for access control and oracle integration
contract RiskParameterEngine is ChariotBase, IRiskParameterEngine {
    using FixedPointMathLib for uint256;

    // -- Constants (WAD precision) --
    uint256 public constant WAD = 1e18;
    uint256 public constant K_LTV = 50e16; // 0.5 -- LTV sensitivity to volatility
    uint256 public constant BASELINE_VOLATILITY = 25e16; // 25% annualized
    uint256 public constant MIN_LTV_FLOOR = 30e16; // 30% absolute minimum
    uint256 public constant LIQUIDATION_BUFFER = 7e16; // 7% above effective LTV

    // -- State --
    mapping(address => bytes32) private _volatilityFeedIds;
    mapping(address => uint256) private _baseLTVs;

    // -- Constructor --
    constructor(address storkOracle_, address admin_) {
        if (admin_ == address(0)) revert ZeroAddress();
        if (storkOracle_ != address(0)) {
            storkOracle = storkOracle_;
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
    }

    // -- Core View Functions --

    /// @notice Calculate effective LTV adjusted for current market volatility
    /// @param collateralToken The collateral token address
    /// @return Effective LTV in WAD (e.g., 70e16 = 70%)
    function getEffectiveLTV(address collateralToken) public view returns (uint256) {
        uint256 baseLTV = _baseLTVs[collateralToken];
        if (baseLTV == 0) revert CollateralNotSupported();

        bytes32 volatilityFeedId = _volatilityFeedIds[collateralToken];
        // MVP fallback: no volatility feed configured, return base LTV
        if (volatilityFeedId == bytes32(0)) return baseLTV;

        // Read current volatility from Stork oracle
        uint256 currentVol = _readVolatility(volatilityFeedId);

        // adjustment = K_LTV * max(0, currentVol - BASELINE_VOLATILITY)
        if (currentVol <= BASELINE_VOLATILITY) return baseLTV;

        uint256 excess = currentVol - BASELINE_VOLATILITY;
        uint256 adjustment = K_LTV.mulWad(excess);

        // effectiveLTV = max(MIN_LTV_FLOOR, baseLTV - adjustment)
        if (adjustment >= baseLTV || baseLTV - adjustment < MIN_LTV_FLOOR) {
            return MIN_LTV_FLOOR;
        }

        return baseLTV - adjustment;
    }

    /// @notice Calculate dynamic liquidation threshold
    /// @param collateralToken The collateral token address
    /// @return Liquidation threshold in WAD (effective LTV + 7% buffer)
    function getLiquidationThreshold(address collateralToken) public view returns (uint256) {
        return getEffectiveLTV(collateralToken) + LIQUIDATION_BUFFER;
    }

    /// @notice Read current volatility from Stork feed for a collateral token
    /// @param collateralToken The collateral token address
    /// @return Current annualized volatility in WAD (e.g., 35e16 = 35%)
    function getCurrentVolatility(address collateralToken) public view returns (uint256) {
        bytes32 volatilityFeedId = _volatilityFeedIds[collateralToken];
        if (volatilityFeedId == bytes32(0)) return 0;
        return _readVolatility(volatilityFeedId);
    }

    /// @notice Get the LTV reduction amount due to volatility
    /// @param collateralToken The collateral token address
    /// @return Adjustment amount in WAD (for frontend display)
    function getVolatilityAdjustment(address collateralToken) public view returns (uint256) {
        bytes32 volatilityFeedId = _volatilityFeedIds[collateralToken];
        if (volatilityFeedId == bytes32(0)) return 0;

        uint256 currentVol = _readVolatility(volatilityFeedId);
        if (currentVol <= BASELINE_VOLATILITY) return 0;

        return K_LTV.mulWad(currentVol - BASELINE_VOLATILITY);
    }

    /// @notice Get all risk parameters in a single call for gas efficiency
    /// @param collateralToken The collateral token address
    /// @return effectiveLTV The dynamic LTV in WAD
    /// @return liquidationThreshold The dynamic liquidation threshold in WAD
    /// @return currentVolatility The current volatility reading in WAD
    function getRiskParameters(address collateralToken)
        external
        view
        returns (uint256 effectiveLTV, uint256 liquidationThreshold, uint256 currentVolatility)
    {
        effectiveLTV = getEffectiveLTV(collateralToken);
        liquidationThreshold = effectiveLTV + LIQUIDATION_BUFFER;
        currentVolatility = getCurrentVolatility(collateralToken);
    }

    // -- Admin Functions --

    /// @notice Configure the Stork volatility feed ID for a collateral token
    /// @param token The collateral token address
    /// @param feedId The Stork feed ID for the token's volatility data
    function setVolatilityFeedId(address token, bytes32 feedId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        _volatilityFeedIds[token] = feedId;
        emit VolatilityFeedConfigured(token, feedId);
    }

    /// @notice Set the base LTV for a collateral token
    /// @param token The collateral token address
    /// @param baseLTV The base LTV in WAD (e.g., 75e16 = 75%)
    function setBaseLTV(address token, uint256 baseLTV) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        if (baseLTV == 0 || baseLTV > WAD) revert InvalidBaseLTV();
        _baseLTVs[token] = baseLTV;
        emit BaseLTVConfigured(token, baseLTV);
    }

    /// @notice Get the volatility feed ID for a collateral token
    function getVolatilityFeedId(address token) external view returns (bytes32) {
        return _volatilityFeedIds[token];
    }

    /// @notice Get the base LTV for a collateral token
    function getBaseLTV(address token) external view returns (uint256) {
        return _baseLTVs[token];
    }

    // -- Internal Functions --

    /// @dev Read volatility from Stork oracle feed
    /// @param feedId The Stork feed ID for the volatility data
    /// @return Volatility value in WAD (e.g., 35e16 = 35%)
    function _readVolatility(bytes32 feedId) internal view returns (uint256) {
        if (storkOracle == address(0)) return 0;

        StorkStructs.TemporalNumericValue memory value = IStork(storkOracle).getTemporalNumericValueV1(feedId);

        // Staleness check: reject data older than STALENESS_THRESHOLD
        uint256 volTimestamp = uint256(value.timestampNs) / 1e9;
        if (block.timestamp - volTimestamp > STALENESS_THRESHOLD) return 0;

        // Guard against negative oracle values (int192 -> uint192 would silently wrap)
        if (value.quantizedValue < 0) revert InvalidVolatilityValue();

        // Stork stores volatility as WAD-scaled percentage (e.g., 35e16 = 35%)
        return uint256(uint192(value.quantizedValue));
    }
}
