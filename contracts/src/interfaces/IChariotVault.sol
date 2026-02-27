// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

/// @title IChariotVault -- Interface for the Chariot ERC-4626 lending vault
/// @dev Extends standard ERC-4626 with lending pool integration and USYC strategy
interface IChariotVault is IERC4626 {
    // -- Events --

    event USDCLent(address indexed pool, uint256 amount);
    event USDCRepaid(address indexed pool, uint256 amount);

    // -- Views --

    /// @notice Total USDC currently lent to the LendingPool
    function totalLent() external view returns (uint256);

    // -- Lending Pool Integration --

    /// @notice Transfer USDC from vault to lending pool for borrower loans
    /// @param amount The USDC amount to lend
    function lend(uint256 amount) external;

    /// @notice Receive USDC back from lending pool on borrower repayment
    /// @param amount The USDC amount being repaid
    function repay(uint256 amount) external;
}
