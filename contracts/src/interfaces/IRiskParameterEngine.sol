// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title IRiskParameterEngine -- Interface for dynamic risk parameter computation
interface IRiskParameterEngine {
    // -- Events --
    event VolatilityFeedConfigured(address indexed token, bytes32 feedId);
    event BaseLTVConfigured(address indexed token, uint256 baseLTV);

    // -- Errors --
    error VolatilityFeedNotConfigured();
    error InvalidVolatilityValue();
    error InvalidBaseLTV();
    error CollateralNotSupported();

    // -- Functions --
    function getEffectiveLTV(address collateralToken) external view returns (uint256);
    function getLiquidationThreshold(address collateralToken) external view returns (uint256);
    function getCurrentVolatility(address collateralToken) external view returns (uint256);
    function getVolatilityAdjustment(address collateralToken) external view returns (uint256);
    function getRiskParameters(address collateralToken)
        external
        view
        returns (uint256 effectiveLTV, uint256 liquidationThreshold, uint256 currentVolatility);
    function setVolatilityFeedId(address token, bytes32 feedId) external;
    function setBaseLTV(address token, uint256 baseLTV) external;
    function getVolatilityFeedId(address token) external view returns (bytes32);
    function getBaseLTV(address token) external view returns (uint256);
}
