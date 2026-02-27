// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IUSYC -- Interface for the Hashnote USYC token
/// @dev USYC is a rebasing-by-price token: count stays fixed, price appreciates over time
interface IUSYC is IERC20 {}
