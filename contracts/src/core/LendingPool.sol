// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ChariotBase} from "../base/ChariotBase.sol";
import {ChariotMath} from "../libraries/ChariotMath.sol";
import {ILendingPool} from "../interfaces/ILendingPool.sol";
import {IInterestRateModel} from "../interfaces/IInterestRateModel.sol";
import {ICollateralManager} from "../interfaces/ICollateralManager.sol";
import {IChariotVault} from "../interfaces/IChariotVault.sol";
import {IStork} from "../interfaces/IStork.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {StorkStructs} from "@stork-oracle/StorkStructs.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

/// @title LendingPool -- Borrow USDC against collateral with continuous interest accrual
/// @notice Core lending contract: borrow, repay, interest accrual via index pattern
/// @dev Interest accrual uses global index pattern -- O(1) per user
contract LendingPool is ChariotBase, ILendingPool {
    using SafeERC20 for IERC20;
    using ChariotMath for uint256;
    using FixedPointMathLib for uint256;

    // -- Constants --
    uint256 public constant SECONDS_PER_YEAR = 31_557_600; // 365.25 * 86400
    uint256 public constant INDEX_PRECISION = 1e18; // WAD
    uint256 public constant WAD = 1e18;

    // -- State --
    mapping(address => BorrowerPosition) private _positions;
    uint256 private _totalBorrowed; // USDC 6 decimals
    uint256 private _totalReserves; // USDC 6 decimals
    uint256 private _globalInterestIndex; // WAD precision
    uint256 private _lastAccrualTimestamp;

    // -- Dependencies --
    IInterestRateModel private _interestRateModel;
    ICollateralManager private _collateralManager;
    IChariotVault private _vault;
    IERC20 private _usdc;

    // -- Modifiers --
    modifier accruesInterest() {
        _accrueInterest();
        _;
    }

    // -- Constructor --
    constructor(address usdc_, address storkOracle_, address admin_) {
        if (usdc_ == address(0) || admin_ == address(0)) revert ZeroAddress();

        _usdc = IERC20(usdc_);
        storkOracle = storkOracle_;
        _globalInterestIndex = INDEX_PRECISION;
        _lastAccrualTimestamp = block.timestamp;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
    }

    // -- External Functions --

    /// @notice Borrow USDC against deposited collateral
    /// @param collateralToken The collateral token used (BridgedETH)
    /// @param amount Amount of USDC to borrow (6 decimals)
    /// @param priceUpdates Stork signed price data for oracle verification
    function borrow(
        address collateralToken,
        uint256 amount,
        StorkStructs.TemporalNumericValueInput[] calldata priceUpdates
    ) external nonReentrant whenNotPaused whenBorrowingAllowed accruesInterest {
        if (amount == 0) revert ZeroAmount();

        // 1. Update oracle prices (pull-oracle pattern)
        if (storkOracle != address(0) && priceUpdates.length > 0) {
            IStork(storkOracle).updateTemporalNumericValuesV1(priceUpdates);
        }

        // 2. Get collateral value and effective LTV
        uint256 collateralValueUsdc = _collateralManager.getCollateralValue(msg.sender, priceUpdates);
        uint256 effectiveLTV = _collateralManager.getEffectiveLTV();

        // 3. Get current debt
        uint256 currentDebt = _getUserDebtInternal(msg.sender);

        // 4. Validate: amount + existing debt <= collateral_value * LTV
        uint256 maxBorrow =
            ChariotMath.wadToUsdc(ChariotMath.wadMul(ChariotMath.usdcToWad(collateralValueUsdc), effectiveLTV));
        if (currentDebt + amount > maxBorrow) revert ExceedsLTV();

        // 5. Update borrower position
        if (_positions[msg.sender].principal == 0) {
            // New borrower
            _positions[msg.sender] = BorrowerPosition({
                principal: amount, interestIndex: _globalInterestIndex, lastAccrualTimestamp: block.timestamp
            });
        } else {
            // Existing borrower: consolidate debt
            _positions[msg.sender].principal = currentDebt + amount;
            _positions[msg.sender].interestIndex = _globalInterestIndex;
            _positions[msg.sender].lastAccrualTimestamp = block.timestamp;
        }

        // 6. Update total borrowed
        _totalBorrowed += amount;

        // 7. Transfer USDC from vault to borrower
        _vault.lend(amount);
        _usdc.safeTransfer(msg.sender, amount);

        // 8. Validate health factor > 1.0 post-borrow
        uint256 healthFactor = _collateralManager.getHealthFactor(msg.sender, priceUpdates);
        if (healthFactor < WAD) revert HealthFactorTooLow();

        // 9. Emit event
        emit Borrowed(msg.sender, collateralToken, amount, healthFactor);
    }

    /// @notice Repay a partial amount of debt
    /// @param amount Amount of USDC to repay (6 decimals). Use type(uint256).max for full repayment.
    function repay(uint256 amount) external nonReentrant accruesInterest {
        if (amount == 0) revert ZeroAmount();

        uint256 currentDebt = _getUserDebtInternal(msg.sender);
        if (currentDebt == 0) revert NoDebt();

        // Handle type(uint256).max as "repay all"
        uint256 repayAmount = amount;
        if (amount >= currentDebt) {
            repayAmount = currentDebt;
        }

        // Transfer USDC from borrower to this contract
        _usdc.safeTransferFrom(msg.sender, address(this), repayAmount);

        // Send USDC to vault
        _usdc.safeIncreaseAllowance(address(_vault), repayAmount);
        _vault.repay(repayAmount);

        // Update borrower position
        if (repayAmount == currentDebt) {
            // Full repayment -- clear position
            _positions[msg.sender].principal = 0;
            _positions[msg.sender].interestIndex = 0;
        } else {
            // Partial repayment -- update principal to remaining debt
            _positions[msg.sender].principal = currentDebt - repayAmount;
            _positions[msg.sender].interestIndex = _globalInterestIndex;
        }

        // Update total borrowed
        _totalBorrowed = _totalBorrowed >= repayAmount ? _totalBorrowed - repayAmount : 0;

        emit Repaid(msg.sender, repayAmount, _getUserDebtInternal(msg.sender));
    }

    /// @notice Repay all outstanding debt including accrued interest
    function repayFull() external nonReentrant accruesInterest {
        uint256 currentDebt = _getUserDebtInternal(msg.sender);
        if (currentDebt == 0) revert NoDebt();

        // Transfer exact debt from borrower
        _usdc.safeTransferFrom(msg.sender, address(this), currentDebt);

        // Send to vault
        _usdc.safeIncreaseAllowance(address(_vault), currentDebt);
        _vault.repay(currentDebt);

        // Clear position
        _positions[msg.sender].principal = 0;
        _positions[msg.sender].interestIndex = 0;

        // Update total borrowed
        _totalBorrowed = _totalBorrowed >= currentDebt ? _totalBorrowed - currentDebt : 0;

        emit Repaid(msg.sender, currentDebt, 0);
    }

    /// @notice Trigger interest accrual externally (used by LiquidationEngine)
    function accrueInterest() external {
        _accrueInterest();
    }

    /// @notice Reduce a borrower's debt during liquidation -- USDC already sent to vault
    /// @param borrower The borrower whose debt is being reduced
    /// @param amount Amount of debt to reduce (USDC 6 decimals)
    function liquidateRepay(address borrower, uint256 amount)
        external
        onlyRole(LIQUIDATION_ENGINE_ROLE)
        nonReentrant
        accruesInterest
    {
        if (amount == 0) revert ZeroAmount();

        uint256 currentDebt = _getUserDebtInternal(borrower);
        if (currentDebt == 0) revert NoDebt();

        // Cap at actual debt
        uint256 repayAmount = amount > currentDebt ? currentDebt : amount;

        // Update borrower position
        if (repayAmount == currentDebt) {
            _positions[borrower].principal = 0;
            _positions[borrower].interestIndex = 0;
        } else {
            _positions[borrower].principal = currentDebt - repayAmount;
            _positions[borrower].interestIndex = _globalInterestIndex;
        }

        // Update total borrowed
        _totalBorrowed = _totalBorrowed >= repayAmount ? _totalBorrowed - repayAmount : 0;

        emit Repaid(borrower, repayAmount, _getUserDebtInternal(borrower));
    }

    // -- View Functions --

    /// @notice Get a user's current debt including accrued interest
    /// @param user The borrower address
    /// @return Current debt in USDC (6 decimals)
    function getUserDebt(address user) external view returns (uint256) {
        return _getUserDebtInternal(user);
    }

    /// @notice Get a user's position details
    function getUserPosition(address user) external view returns (BorrowerPosition memory) {
        return _positions[user];
    }

    /// @notice Get total borrowed across all users
    function getTotalBorrowed() external view returns (uint256) {
        return _totalBorrowed;
    }

    /// @notice Get total protocol reserves
    function getTotalReserves() external view returns (uint256) {
        return _totalReserves;
    }

    /// @notice Get the last interest accrual timestamp
    function getLastAccrualTimestamp() external view returns (uint256) {
        return _lastAccrualTimestamp;
    }

    /// @notice Get the current global interest index
    function getGlobalInterestIndex() external view returns (uint256) {
        return _globalInterestIndex;
    }

    // -- Admin Functions --

    function setInterestRateModel(address interestRateModel_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _interestRateModel = IInterestRateModel(interestRateModel_);
    }

    function setCollateralManager(address collateralManager_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _collateralManager = ICollateralManager(collateralManager_);
    }

    function setVault(address vault_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _vault = IChariotVault(vault_);
    }

    // -- Internal Functions --

    /// @dev Accrue interest based on time elapsed since last accrual
    function _accrueInterest() internal {
        uint256 timeDelta = block.timestamp - _lastAccrualTimestamp;
        if (timeDelta == 0) return;
        if (_totalBorrowed == 0) {
            _lastAccrualTimestamp = block.timestamp;
            return;
        }

        // Get current utilisation
        uint256 totalAssets = _vault.totalAssets();
        uint256 utilisation = totalAssets > 0 ? _interestRateModel.getUtilisation(_totalBorrowed, totalAssets) : 0;

        // Get borrow rate
        uint256 borrowRate = _interestRateModel.getBorrowRate(utilisation);

        // Calculate interest factor for this period
        // interestFactor = borrowRate * timeDelta / SECONDS_PER_YEAR
        uint256 interestFactor = borrowRate.mulWad(timeDelta * WAD / SECONDS_PER_YEAR);

        // Calculate new interest in USDC terms
        uint256 newInterestWad = ChariotMath.usdcToWad(_totalBorrowed).mulWad(interestFactor);
        uint256 newInterest = ChariotMath.wadToUsdc(newInterestWad);

        // Calculate reserve share
        uint256 reserveFactor = _interestRateModel.getReserveFactor();
        uint256 reserveShare = ChariotMath.wadToUsdc(ChariotMath.usdcToWad(newInterest).mulWad(reserveFactor));

        // Update state
        _totalBorrowed += newInterest;
        _totalReserves += reserveShare;
        _globalInterestIndex = _globalInterestIndex.mulWad(WAD + interestFactor);
        _lastAccrualTimestamp = block.timestamp;

        emit InterestAccrued(newInterest, _globalInterestIndex, _totalBorrowed);
    }

    /// @dev Calculate user debt without modifying state
    function _getUserDebtInternal(address user) internal view returns (uint256) {
        BorrowerPosition memory pos = _positions[user];
        if (pos.principal == 0 || pos.interestIndex == 0) return 0;

        // currentDebt = principal * globalIndex / borrowerIndex
        return ChariotMath.wadToUsdc(
            ChariotMath.usdcToWad(pos.principal).mulWad(_globalInterestIndex.divWad(pos.interestIndex))
        );
    }
}
