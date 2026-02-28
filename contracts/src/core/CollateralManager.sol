// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ChariotBase} from "../base/ChariotBase.sol";
import {ChariotMath} from "../libraries/ChariotMath.sol";
import {ICollateralManager} from "../interfaces/ICollateralManager.sol";
import {ILendingPool} from "../interfaces/ILendingPool.sol";
import {IRiskParameterEngine} from "../interfaces/IRiskParameterEngine.sol";
import {IStork} from "../interfaces/IStork.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {StorkStructs} from "@stork-oracle/StorkStructs.sol";

/// @title CollateralManager -- Manages BridgedETH collateral deposits and withdrawals
/// @notice Tracks per-user collateral balances, calculates health factor using Stork oracle
/// @dev Extends ChariotBase for access control, reentrancy, and oracle integration
contract CollateralManager is ChariotBase, ICollateralManager {
    using SafeERC20 for IERC20;
    using ChariotMath for uint256;

    // -- Constants --
    uint256 public constant BASE_LTV = 0.75e18; // 75%
    uint256 public constant MIN_LTV = 0.3e18; // 30%
    uint256 public constant LIQUIDATION_BUFFER = 0.07e18; // 7%
    uint256 public constant LIQUIDATION_THRESHOLD = 0.82e18; // 82% = BASE_LTV + LIQUIDATION_BUFFER

    /// @dev Stork oracle feed ID for ETHUSD
    bytes32 public constant ETHUSD_FEED_ID = 0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160;

    // -- Structs --
    struct CollateralConfig {
        uint256 baseLTV; // WAD (e.g., 75e16 = 75%)
        uint256 liquidationThreshold; // WAD (e.g., 82e16 = 82%)
        uint256 liquidationBonus; // WAD (e.g., 5e16 = 5%)
        bytes32 priceFeedId; // Stork feed ID for price
        bytes32 volatilityFeedId; // Stork feed ID for volatility (Phase 2)
        bool isActive; // Whether this collateral type is enabled
    }

    // -- State --
    mapping(address => mapping(address => uint256)) private _userCollateral;
    mapping(address => bytes32) private _priceFeedIds;
    mapping(address => CollateralConfig) private _collateralConfigs;
    address[] private _supportedCollateralTokens;
    ILendingPool private _lendingPool;
    IRiskParameterEngine private _riskParameterEngine;
    address private immutable _bridgedETH;

    // -- Events --
    event PriceFeedIdSet(address indexed token, bytes32 feedId);
    event CollateralTypeAdded(
        address indexed token, uint256 baseLTV, uint256 liquidationThreshold, uint256 liquidationBonus
    );
    event CollateralConfigUpdated(
        address indexed token, uint256 baseLTV, uint256 liquidationThreshold, uint256 liquidationBonus
    );
    event LendingPoolUpdated(address indexed oldPool, address indexed newPool);
    event RiskParameterEngineUpdated(address indexed oldEngine, address indexed newEngine);

    // -- Errors --
    error InvalidLTV();
    error InvalidThreshold();
    error InvalidBonus();
    error AssetAlreadyExists();
    error AssetNotFound();

    // -- Constructor --
    constructor(address bridgedETH_, address storkOracle_, address admin_) {
        if (bridgedETH_ == address(0) || admin_ == address(0)) revert ZeroAddress();

        _bridgedETH = bridgedETH_;
        storkOracle = storkOracle_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);

        // Initialize BridgedETH price feed ID
        _priceFeedIds[bridgedETH_] = ETHUSD_FEED_ID;
    }

    // -- External Functions --

    /// @notice Deposit BridgedETH as collateral
    /// @param token The collateral token address (must be BridgedETH for MVP)
    /// @param amount Amount of tokens to deposit
    function depositCollateral(address token, uint256 amount) external nonReentrant whenNotPaused {
        if (token != _bridgedETH) revert InvalidToken();
        if (amount == 0) revert ZeroAmount();

        // Effects
        _userCollateral[msg.sender][token] += amount;

        // Interactions
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit CollateralDeposited(msg.sender, token, amount);
    }

    /// @notice Withdraw collateral -- only allowed when user has zero debt
    /// @param token The collateral token address
    /// @param amount Amount to withdraw
    function withdrawCollateral(address token, uint256 amount) external nonReentrant whenNotPaused {
        if (token != _bridgedETH) revert InvalidToken();
        if (amount == 0) revert ZeroAmount();

        // Check debt is zero
        if (address(_lendingPool) != address(0) && _lendingPool.getUserDebt(msg.sender) > 0) {
            revert DebtOutstanding();
        }

        uint256 balance = _userCollateral[msg.sender][token];
        if (amount > balance) revert InsufficientCollateral();

        // Effects
        _userCollateral[msg.sender][token] = balance - amount;

        // Interactions
        IERC20(token).safeTransfer(msg.sender, amount);

        emit CollateralWithdrawn(msg.sender, token, amount);
    }

    /// @notice Get a user's collateral balance for a specific token
    function getCollateralBalance(address user, address token) external view returns (uint256) {
        return _userCollateral[user][token];
    }

    /// @notice Calculate the USD value of a user's collateral using Stork oracle
    /// @param user The borrower address
    /// @param priceUpdates Stork signed price data for oracle update
    /// @return Collateral value in USDC terms (6 decimals)
    function getCollateralValue(address user, StorkStructs.TemporalNumericValueInput[] calldata priceUpdates)
        public
        returns (uint256)
    {
        uint256 collateralAmount = _userCollateral[user][_bridgedETH];
        if (collateralAmount == 0) return 0;

        // Update oracle prices (pull-oracle pattern)
        if (storkOracle != address(0) && priceUpdates.length > 0) {
            IStork(storkOracle).updateTemporalNumericValuesV1(priceUpdates);
        }

        // Read ETHUSD price from Stork (18 decimals int192)
        uint256 ethPrice = _getETHPrice();

        // collateral_amount (18 dec) * ethPrice (18 dec) / WAD = value in 18 dec
        // Then convert to 6 dec (USDC terms)
        uint256 valueWad = ChariotMath.wadMul(collateralAmount, ethPrice);
        return ChariotMath.wadToUsdc(valueWad);
    }

    /// @notice Calculate health factor for a borrower
    /// @param user The borrower address
    /// @param priceUpdates Stork signed price data
    /// @return Health factor in WAD precision (1e18 = 1.0)
    function getHealthFactor(address user, StorkStructs.TemporalNumericValueInput[] calldata priceUpdates)
        external
        returns (uint256)
    {
        if (address(_lendingPool) == address(0)) return type(uint256).max;

        uint256 debt = _lendingPool.getUserDebt(user);
        if (debt == 0) return type(uint256).max;

        uint256 collateralValueUsdc = getCollateralValue(user, priceUpdates);
        if (collateralValueUsdc == 0) return 0;

        // HF = (collateral_value * liquidation_threshold) / debt
        // Both collateralValueUsdc and debt are in 6 decimals (USDC)
        // Convert to WAD for precise division
        uint256 collateralWad = ChariotMath.usdcToWad(collateralValueUsdc);
        uint256 debtWad = ChariotMath.usdcToWad(debt);

        uint256 liqThreshold = _getActiveLiquidationThreshold();
        uint256 thresholdValue = ChariotMath.wadMul(collateralWad, liqThreshold);
        return ChariotMath.wadDiv(thresholdValue, debtWad);
    }

    /// @notice Get the effective LTV -- delegates to RiskParameterEngine if set
    function getEffectiveLTV() external view returns (uint256) {
        if (address(_riskParameterEngine) != address(0)) {
            return _riskParameterEngine.getEffectiveLTV(_bridgedETH);
        }
        return BASE_LTV;
    }

    /// @notice Get the liquidation threshold -- delegates to RiskParameterEngine if set
    function getLiquidationThreshold() external view returns (uint256) {
        return _getActiveLiquidationThreshold();
    }

    /// @notice Get the BridgedETH token address
    function getBridgedETH() external view returns (address) {
        return _bridgedETH;
    }

    /// @notice Get the USD value of a user's collateral using stored oracle price (view-only)
    /// @param user The borrower address
    /// @return Collateral value in USDC terms (6 decimals)
    function getCollateralValueView(address user) external view returns (uint256) {
        uint256 collateralAmount = _userCollateral[user][_bridgedETH];
        if (collateralAmount == 0) return 0;

        uint256 ethPrice = _getETHPrice();
        if (ethPrice == 0) return 0;

        uint256 valueWad = ChariotMath.wadMul(collateralAmount, ethPrice);
        return ChariotMath.wadToUsdc(valueWad);
    }

    /// @notice Get the current stored ETH/USD price from oracle
    /// @return ETH price in WAD (18 decimals)
    function getETHPrice() external view returns (uint256) {
        return _getETHPrice();
    }

    /// @notice Seize collateral from a borrower during liquidation
    /// @param borrower The borrower whose collateral is seized
    /// @param token The collateral token address
    /// @param amount Amount of collateral to seize (18 decimals for BridgedETH)
    /// @param recipient The liquidator receiving the seized collateral
    function seizeCollateral(address borrower, address token, uint256 amount, address recipient)
        external
        onlyRole(LIQUIDATION_ENGINE_ROLE)
        nonReentrant
    {
        if (token != _bridgedETH) revert InvalidToken();
        if (amount == 0) revert ZeroAmount();

        uint256 balance = _userCollateral[borrower][token];
        if (amount > balance) revert InsufficientCollateral();

        // Effects
        _userCollateral[borrower][token] = balance - amount;

        // Interactions
        IERC20(token).safeTransfer(recipient, amount);

        emit CollateralSeized(borrower, recipient, token, amount);
    }

    // -- Admin Functions --

    /// @notice Set the RiskParameterEngine for dynamic LTV/threshold
    /// @param riskParameterEngine_ The RiskParameterEngine contract address
    function setRiskParameterEngine(address riskParameterEngine_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        address old = address(_riskParameterEngine);
        _riskParameterEngine = IRiskParameterEngine(riskParameterEngine_);
        emit RiskParameterEngineUpdated(old, riskParameterEngine_);
    }

    /// @notice Set the LendingPool reference for debt checks
    /// @param lendingPool_ The LendingPool contract address
    function setLendingPool(address lendingPool_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (lendingPool_ == address(0)) revert ZeroAddress();
        address old = address(_lendingPool);
        _lendingPool = ILendingPool(lendingPool_);
        emit LendingPoolUpdated(old, lendingPool_);
    }

    /// @notice Set the Stork price feed ID for a collateral token
    /// @param token The collateral token address
    /// @param feedId The Stork feed ID for the token's price
    function setPriceFeedId(address token, bytes32 feedId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        if (feedId == bytes32(0)) revert OracleFeedNotConfigured();
        _priceFeedIds[token] = feedId;
        emit PriceFeedIdSet(token, feedId);
    }

    /// @notice Get the price feed ID for a collateral token
    function getPriceFeedId(address token) external view returns (bytes32) {
        return _priceFeedIds[token];
    }

    /// @notice Add a new collateral type with full configuration
    /// @param token The collateral token address
    /// @param config The collateral configuration
    function addCollateralType(address token, CollateralConfig calldata config) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        if (_collateralConfigs[token].isActive) revert AssetAlreadyExists();
        _validateCollateralConfig(config);

        _collateralConfigs[token] = config;
        _supportedCollateralTokens.push(token);
        _priceFeedIds[token] = config.priceFeedId;

        emit CollateralTypeAdded(token, config.baseLTV, config.liquidationThreshold, config.liquidationBonus);
    }

    /// @notice Update configuration for an existing collateral type
    /// @param token The collateral token address
    /// @param config The new collateral configuration
    function updateCollateralConfig(address token, CollateralConfig calldata config)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (!_collateralConfigs[token].isActive) revert AssetNotFound();
        _validateCollateralConfig(config);

        _collateralConfigs[token] = config;
        _priceFeedIds[token] = config.priceFeedId;

        emit CollateralConfigUpdated(token, config.baseLTV, config.liquidationThreshold, config.liquidationBonus);
    }

    /// @notice Get the collateral configuration for a token
    function getCollateralConfig(address token) external view returns (CollateralConfig memory) {
        return _collateralConfigs[token];
    }

    /// @notice Get all supported collateral token addresses
    function getSupportedCollateralTokens() external view returns (address[] memory) {
        return _supportedCollateralTokens;
    }

    // -- Internal Functions --

    /// @dev Get the active liquidation threshold -- dynamic or static fallback
    function _getActiveLiquidationThreshold() internal view returns (uint256) {
        if (address(_riskParameterEngine) != address(0)) {
            return _riskParameterEngine.getLiquidationThreshold(_bridgedETH);
        }
        return LIQUIDATION_THRESHOLD;
    }

    /// @dev Validate collateral configuration parameters
    function _validateCollateralConfig(CollateralConfig calldata config) internal pure {
        if (config.baseLTV == 0 || config.baseLTV > 1e18) revert InvalidLTV();
        if (config.liquidationThreshold <= config.baseLTV) revert InvalidThreshold();
        if (config.liquidationBonus == 0 || config.liquidationBonus > 0.5e18) revert InvalidBonus();
        if (config.priceFeedId == bytes32(0)) revert OracleFeedNotConfigured();
    }

    /// @dev Read ETH/USD price from Stork oracle using configured feed ID
    /// @notice Uses _priceFeedIds mapping with fallback to ETHUSD_FEED_ID constant.
    ///         Returns 0 on stale data (> STALENESS_THRESHOLD seconds old) -- callers must handle.
    function _getETHPrice() internal view returns (uint256) {
        if (storkOracle == address(0)) return 0;

        bytes32 feedId = _priceFeedIds[_bridgedETH];
        if (feedId == bytes32(0)) feedId = ETHUSD_FEED_ID;

        StorkStructs.TemporalNumericValue memory value = IStork(storkOracle).getTemporalNumericValueV1(feedId);

        // Staleness check: data older than STALENESS_THRESHOLD (3600s) is rejected.
        // Boundary: exactly STALENESS_THRESHOLD seconds old is still valid (> not >=).
        uint256 priceTimestamp = uint256(value.timestampNs) / 1e9;
        if (block.timestamp - priceTimestamp > STALENESS_THRESHOLD) {
            return 0; // Stale price -- return 0 to prevent operations
        }

        return uint256(uint192(value.quantizedValue));
    }
}
