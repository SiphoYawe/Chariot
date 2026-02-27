// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ChariotBase} from "../base/ChariotBase.sol";
import {ChariotMath} from "../libraries/ChariotMath.sol";
import {ICollateralManager} from "../interfaces/ICollateralManager.sol";
import {ILendingPool} from "../interfaces/ILendingPool.sol";
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

    // -- State --
    mapping(address => mapping(address => uint256)) private _userCollateral;
    ILendingPool private _lendingPool;
    address private immutable _bridgedETH;

    // -- Constructor --
    constructor(address bridgedETH_, address storkOracle_, address admin_) {
        if (bridgedETH_ == address(0) || admin_ == address(0)) revert ZeroAddress();

        _bridgedETH = bridgedETH_;
        storkOracle = storkOracle_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
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

        // HF = (collateral_value * LIQUIDATION_THRESHOLD) / debt
        // Both collateralValueUsdc and debt are in 6 decimals (USDC)
        // Convert to WAD for precise division
        uint256 collateralWad = ChariotMath.usdcToWad(collateralValueUsdc);
        uint256 debtWad = ChariotMath.usdcToWad(debt);

        uint256 thresholdValue = ChariotMath.wadMul(collateralWad, LIQUIDATION_THRESHOLD);
        return ChariotMath.wadDiv(thresholdValue, debtWad);
    }

    /// @notice Get the effective LTV for MVP (static 75%)
    function getEffectiveLTV() external pure returns (uint256) {
        return BASE_LTV;
    }

    /// @notice Get the liquidation threshold
    function getLiquidationThreshold() external pure returns (uint256) {
        return LIQUIDATION_THRESHOLD;
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

    /// @notice Set the LendingPool reference for debt checks
    /// @param lendingPool_ The LendingPool contract address
    function setLendingPool(address lendingPool_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _lendingPool = ILendingPool(lendingPool_);
    }

    // -- Internal Functions --

    /// @dev Read ETH/USD price from Stork oracle
    function _getETHPrice() internal view returns (uint256) {
        if (storkOracle == address(0)) return 0;

        StorkStructs.TemporalNumericValue memory value = IStork(storkOracle).getTemporalNumericValueV1(ETHUSD_FEED_ID);

        // Staleness check
        uint256 priceTimestamp = uint256(value.timestampNs) / 1e9;
        if (block.timestamp - priceTimestamp > STALENESS_THRESHOLD) {
            return 0; // Stale price -- return 0 to prevent operations
        }

        return uint256(uint192(value.quantizedValue));
    }
}
