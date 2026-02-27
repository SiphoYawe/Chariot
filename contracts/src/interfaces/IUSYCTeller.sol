// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title IUSYCTeller -- Interface for the Hashnote USYC Teller contract
/// @dev Handles deposit (USDC -> USYC) and redeem (USYC -> USDC) with T+0 settlement
interface IUSYCTeller {
    /// @notice Deposit USDC and receive USYC tokens
    /// @param amount The USDC amount to deposit
    /// @return usycReceived The USYC tokens minted
    function deposit(uint256 amount) external returns (uint256 usycReceived);

    /// @notice Redeem USYC tokens for USDC
    /// @param usycAmount The USYC amount to redeem
    /// @return usdcReceived The USDC returned
    function redeem(uint256 usycAmount) external returns (uint256 usdcReceived);

    /// @notice Preview USDC amount from redeeming USYC (view function)
    /// @param usycAmount The USYC amount to preview
    /// @return usdcAmount The USDC that would be returned
    function previewRedeem(uint256 usycAmount) external view returns (uint256 usdcAmount);

    /// @notice Preview USYC amount from depositing USDC (view function)
    /// @param usdcAmount The USDC amount to preview
    /// @return usycAmount The USYC that would be minted
    function previewDeposit(uint256 usdcAmount) external view returns (uint256 usycAmount);
}
