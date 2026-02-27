// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {StorkStructs} from "@stork-oracle/StorkStructs.sol";

/// @title IStork -- Interface for the Stork pull-oracle on-chain verifier
interface IStork {
    function updateTemporalNumericValuesV1(
        StorkStructs.TemporalNumericValueInput[] calldata updateData
    ) external payable;

    function getTemporalNumericValueV1(
        bytes32 id
    ) external view returns (StorkStructs.TemporalNumericValue memory);

    function getUpdateFeeV1(
        StorkStructs.TemporalNumericValueInput[] calldata updateData
    ) external view returns (uint256);
}
