// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ChariotBase} from "../base/ChariotBase.sol";
import {IUSYCTeller} from "../interfaces/IUSYCTeller.sol";

/// @title ChariotVault -- ERC-4626 dual-yield lending vault
/// @notice Accepts USDC deposits, mints chUSDC shares. Total assets = idle USDC + lent USDC + USYC value.
/// @dev Inherits ChariotBase for access control and reentrancy protection.
contract ChariotVault is ChariotBase, ERC4626 {
    using SafeERC20 for IERC20;

    // -- Immutables --
    IERC20 public immutable USYC;
    IUSYCTeller public immutable TELLER;

    // -- Constants --
    uint256 public constant BUFFER_PERCENT = 0.05e18; // 5% liquid buffer
    uint256 public constant REBALANCE_THRESHOLD = 100e6; // 100 USDC minimum to trigger

    // -- State --
    uint256 private _totalLent;

    // -- Events --
    event USDCLent(address indexed pool, uint256 amount);
    event USDCRepaid(address indexed pool, uint256 amount);
    event Rebalanced(uint256 usdcDeposited, uint256 usdcRedeemed, uint256 usycBalance);

    // -- Custom Errors --
    error ExceedsAvailable(uint256 requested, uint256 available);
    error USYCNotConfigured();

    // -- Constructor --

    /// @param _usdc USDC token address (underlying asset)
    /// @param _usyc USYC token address (or address(0) if not yet configured)
    /// @param _usycTeller USYC Teller contract (or address(0) if not yet configured)
    /// @param _storkOracle Stork oracle address
    /// @param _admin Initial admin address (receives DEFAULT_ADMIN_ROLE + OPERATOR_ROLE)
    constructor(
        address _usdc,
        address _usyc,
        address _usycTeller,
        address _storkOracle,
        address _admin
    )
        ERC4626(IERC20(_usdc))
        ERC20("Chariot USDC", "chUSDC")
    {
        if (_usdc == address(0) || _admin == address(0)) revert ZeroAddress();

        USYC = IERC20(_usyc);
        TELLER = IUSYCTeller(_usycTeller);
        storkOracle = _storkOracle;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
    }

    // -- ERC-4626 Overrides --

    /// @notice Total assets under management: idle USDC + lent USDC + USYC value
    function totalAssets() public view override returns (uint256) {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        uint256 lent = _totalLent;
        uint256 usycVal = _usycValue();
        return idle + lent + usycVal;
    }

    // -- Lending Pool Integration --

    /// @notice Total USDC currently lent to the LendingPool
    function totalLent() external view returns (uint256) {
        return _totalLent;
    }

    /// @notice Transfer USDC from vault to LendingPool for borrower loans
    /// @param amount USDC amount to lend (6 decimals)
    function lend(uint256 amount) external onlyRole(LENDING_POOL_ROLE) nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (amount > idle) revert ExceedsAvailable(amount, idle);

        _totalLent += amount;
        IERC20(asset()).safeTransfer(msg.sender, amount);

        emit USDCLent(msg.sender, amount);
    }

    /// @notice Receive USDC back from LendingPool on borrower repayment
    /// @param amount USDC amount being repaid (6 decimals)
    function repay(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > _totalLent) revert ExceedsAvailable(amount, _totalLent);

        IERC20(asset()).safeTransferFrom(msg.sender, address(this), amount);
        _totalLent -= amount;

        emit USDCRepaid(msg.sender, amount);
    }

    // -- USYC Strategy --

    /// @notice Rebalance idle USDC into USYC or redeem USYC for liquidity
    /// @dev Maintains 5% liquid USDC buffer. Callable by OPERATOR_ROLE (agent) or admin.
    function rebalance() external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        if (address(USYC) == address(0) || address(TELLER) == address(0)) revert USYCNotConfigured();

        uint256 total = totalAssets();
        if (total == 0) return;

        uint256 targetBuffer = (total * BUFFER_PERCENT) / 1e18;
        uint256 currentIdle = IERC20(asset()).balanceOf(address(this));

        if (currentIdle > targetBuffer + REBALANCE_THRESHOLD) {
            // Excess idle USDC -- deposit to USYC Teller
            uint256 excess = currentIdle - targetBuffer;
            IERC20(asset()).forceApprove(address(TELLER), excess);
            TELLER.deposit(excess);

            emit Rebalanced(excess, 0, USYC.balanceOf(address(this)));
        } else if (currentIdle < targetBuffer) {
            // Shortfall -- redeem USYC from Teller to cover liquidity gap
            uint256 shortfall = targetBuffer - currentIdle;
            uint256 usycBalance = USYC.balanceOf(address(this));
            if (usycBalance == 0) return;

            // Calculate USYC needed to cover shortfall
            uint256 usycToRedeem = TELLER.previewDeposit(shortfall);
            if (usycToRedeem > usycBalance) usycToRedeem = usycBalance;

            USYC.forceApprove(address(TELLER), usycToRedeem);
            uint256 usdcReceived = TELLER.redeem(usycToRedeem);

            emit Rebalanced(0, usdcReceived, USYC.balanceOf(address(this)));
        }
    }

    // -- Internal Helpers --

    /// @dev Calculate USDC value of vault's USYC holdings via the Teller preview
    function _usycValue() internal view returns (uint256) {
        if (address(USYC) == address(0) || address(TELLER) == address(0)) return 0;
        uint256 usycBalance = USYC.balanceOf(address(this));
        if (usycBalance == 0) return 0;
        return TELLER.previewRedeem(usycBalance);
    }

}
