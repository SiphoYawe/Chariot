// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ChariotBase} from "../base/ChariotBase.sol";
import {ChariotMath} from "../libraries/ChariotMath.sol";
import {ILiquidationEngine} from "../interfaces/ILiquidationEngine.sol";
import {ILendingPool} from "../interfaces/ILendingPool.sol";
import {ICollateralManager} from "../interfaces/ICollateralManager.sol";
import {IChariotVault} from "../interfaces/IChariotVault.sol";
import {IStork} from "../interfaces/IStork.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {StorkStructs} from "@stork-oracle/StorkStructs.sol";

/// @title LiquidationEngine -- Core liquidation logic for undercollateralized positions
/// @notice Allows liquidators to repay borrower debt and seize collateral with a 5% bonus
/// @dev Extends ChariotBase for access control and reentrancy protection
contract LiquidationEngine is ChariotBase, ILiquidationEngine {
    using SafeERC20 for IERC20;

    // -- Constants --
    uint256 public constant WAD = 1e18;
    uint256 public constant LIQUIDATION_BONUS = 5e16; // 5% fixed for MVP
    uint256 public constant LIQUIDATION_THRESHOLD_BUFFER = 7e16; // 7%
    uint256 public constant MAX_LIQUIDATION_RATIO = 50e16; // 50% max debt repayable per liquidation

    // -- Dependencies --
    ILendingPool private _lendingPool;
    ICollateralManager private _collateralManager;
    IChariotVault private _vault;
    IERC20 private _usdc;

    struct LiquidationParams {
        uint256 borrowerDebt;
        uint256 seizureAmount;
    }

    // -- Constructor --
    constructor(address usdc_, address storkOracle_, address admin_) {
        if (usdc_ == address(0) || admin_ == address(0)) revert ZeroAddress();

        _usdc = IERC20(usdc_);
        storkOracle = storkOracle_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
    }

    // -- External Functions --

    /// @notice Liquidate an undercollateralized borrower position
    /// @param borrower The borrower to liquidate
    /// @param collateralToken The collateral token to seize (BridgedETH)
    /// @param debtToRepay Amount of USDC debt to repay (6 decimals)
    /// @param priceUpdates Stork signed price data for atomic oracle update
    function liquidate(
        address borrower,
        address collateralToken,
        uint256 debtToRepay,
        StorkStructs.TemporalNumericValueInput[] calldata priceUpdates
    ) external nonReentrant whenNotPaused {
        if (debtToRepay == 0) revert ZeroAmount();
        if (borrower == msg.sender) revert SelfLiquidation();

        // 1. Update oracle + accrue interest
        _updateOracleAndAccrue(priceUpdates);

        // 2. Validate position and calculate seizure
        LiquidationParams memory params = _validateAndCalculate(borrower, collateralToken, debtToRepay);

        // 3. Execute liquidation transfers
        _executeLiquidation(borrower, collateralToken, debtToRepay, params.seizureAmount);

        // 4. Emit event
        emit PositionLiquidated(
            borrower, msg.sender, collateralToken, debtToRepay, params.seizureAmount, LIQUIDATION_BONUS
        );
    }

    /// @notice Get the liquidation threshold for a collateral token
    /// @return Liquidation threshold in WAD (e.g., 82e16 = 82%)
    function getLiquidationThreshold(address) public view returns (uint256) {
        return _collateralManager.getLiquidationThreshold();
    }

    /// @notice Get the liquidation bonus for a collateral token
    /// @return Liquidation bonus in WAD (e.g., 5e16 = 5%)
    function getLiquidationBonus(address) external pure returns (uint256) {
        return LIQUIDATION_BONUS;
    }

    /// @notice Check if a borrower's position is liquidatable based on stored oracle data
    /// @dev Uses stored oracle price without updating -- may be slightly stale. Actual liquidation uses fresh data.
    function isLiquidatable(address borrower) external view returns (bool) {
        uint256 debt = _lendingPool.getUserDebt(borrower);
        if (debt == 0) return false;

        // If oracle price is stale, cannot determine liquidatability
        uint256 ethPrice = _collateralManager.getETHPrice();
        if (ethPrice == 0) return false;

        uint256 collateralValueUsdc = _collateralManager.getCollateralValueView(borrower);
        if (collateralValueUsdc == 0) return true;

        uint256 healthFactor = _calculateHealthFactor(collateralValueUsdc, debt);
        return healthFactor < WAD;
    }

    /// @notice Calculate the amount of collateral to seize given debt repayment
    /// @param debtToRepayWad Debt amount in WAD (18 decimals)
    /// @param collateralPrice Collateral price in WAD (18 decimals)
    /// @param bonus Liquidation bonus in WAD (e.g., 5e16 = 5%)
    /// @return Collateral amount to seize in 18 decimals
    function calculateSeizableCollateral(uint256 debtToRepayWad, uint256 collateralPrice, uint256 bonus)
        public
        pure
        returns (uint256)
    {
        uint256 baseCollateral = ChariotMath.wadDiv(debtToRepayWad, collateralPrice);
        return ChariotMath.wadMul(baseCollateral, WAD + bonus);
    }

    // -- Admin Functions --

    function setLendingPool(address lendingPool_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (lendingPool_ == address(0)) revert ZeroAddress();
        _lendingPool = ILendingPool(lendingPool_);
    }

    function setCollateralManager(address collateralManager_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (collateralManager_ == address(0)) revert ZeroAddress();
        _collateralManager = ICollateralManager(collateralManager_);
    }

    function setVault(address vault_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (vault_ == address(0)) revert ZeroAddress();
        _vault = IChariotVault(vault_);
    }

    // -- Internal Functions --

    function _updateOracleAndAccrue(StorkStructs.TemporalNumericValueInput[] calldata priceUpdates) internal {
        if (storkOracle != address(0) && priceUpdates.length > 0) {
            IStork(storkOracle).updateTemporalNumericValuesV1(priceUpdates);
        }
        _lendingPool.accrueInterest();
    }

    function _validateAndCalculate(address borrower, address collateralToken, uint256 debtToRepay)
        internal
        view
        returns (LiquidationParams memory params)
    {
        // Get debt
        params.borrowerDebt = _lendingPool.getUserDebt(borrower);
        if (params.borrowerDebt == 0) revert PositionNotLiquidatable();

        // Get collateral value (oracle already updated, use view)
        uint256 collateralValueUsdc = _collateralManager.getCollateralValueView(borrower);

        // Calculate and validate health factor
        uint256 healthFactor = _calculateHealthFactor(collateralValueUsdc, params.borrowerDebt);
        if (healthFactor >= WAD) revert PositionNotLiquidatable();

        // Validate max liquidation ratio
        uint256 maxRepayable =
            ChariotMath.wadToUsdc(ChariotMath.wadMul(ChariotMath.usdcToWad(params.borrowerDebt), MAX_LIQUIDATION_RATIO));
        if (debtToRepay > maxRepayable) revert ExceedsMaxLiquidation();

        // Calculate seizure amount
        uint256 ethPrice = _collateralManager.getETHPrice();
        if (ethPrice == 0) revert StalePriceData();

        params.seizureAmount = calculateSeizableCollateral(ChariotMath.usdcToWad(debtToRepay), ethPrice, LIQUIDATION_BONUS);

        // Validate sufficient collateral
        uint256 collateralBalance = _collateralManager.getCollateralBalance(borrower, collateralToken);
        if (params.seizureAmount > collateralBalance) revert InsufficientCollateralForSeizure();
    }

    function _executeLiquidation(address borrower, address collateralToken, uint256 debtToRepay, uint256 seizureAmount)
        internal
    {
        // Transfer USDC from liquidator to this contract
        _usdc.safeTransferFrom(msg.sender, address(this), debtToRepay);

        // Send USDC to vault (repayment)
        _usdc.forceApprove(address(_vault), debtToRepay);
        _vault.repay(debtToRepay);

        // Reduce borrower debt in LendingPool (accounting only)
        _lendingPool.liquidateRepay(borrower, debtToRepay);

        // Seize collateral and send to liquidator
        _collateralManager.seizeCollateral(borrower, collateralToken, seizureAmount, msg.sender);
    }

    function _calculateHealthFactor(uint256 collateralValueUsdc, uint256 debt) internal view returns (uint256) {
        uint256 collateralWad = ChariotMath.usdcToWad(collateralValueUsdc);
        uint256 debtWad = ChariotMath.usdcToWad(debt);
        uint256 liqThreshold = _collateralManager.getLiquidationThreshold();
        uint256 thresholdValue = ChariotMath.wadMul(collateralWad, liqThreshold);
        return ChariotMath.wadDiv(thresholdValue, debtWad);
    }
}
