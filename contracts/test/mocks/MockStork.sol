// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {StorkStructs} from "@stork-oracle/StorkStructs.sol";
import {IStork} from "../../src/interfaces/IStork.sol";

/// @title MockStork -- Mock Stork oracle for testing
contract MockStork is IStork {
    error MockStorkNotFound();
    error MockStorkInvalidSignature();

    mapping(bytes32 => StorkStructs.TemporalNumericValue) private _values;
    bool private _shouldRevertOnUpdate;

    /// @notice Set a mock price value for a feed
    /// @param id The feed ID (e.g., keccak256("ETHUSD"))
    /// @param value The price value (int192, 18 decimals)
    /// @param timestampNs The timestamp in nanoseconds
    function setPrice(bytes32 id, int192 value, uint64 timestampNs) external {
        _values[id] = StorkStructs.TemporalNumericValue({timestampNs: timestampNs, quantizedValue: value});
    }

    /// @notice Set a mock price with current block timestamp
    function setPriceNow(bytes32 id, int192 value) external {
        _values[id] =
            StorkStructs.TemporalNumericValue({timestampNs: uint64(block.timestamp) * 1e9, quantizedValue: value});
    }

    /// @notice Configure whether updateTemporalNumericValuesV1 should revert (simulates invalid signature)
    function setShouldRevertOnUpdate(bool shouldRevert) external {
        _shouldRevertOnUpdate = shouldRevert;
    }

    function updateTemporalNumericValuesV1(StorkStructs.TemporalNumericValueInput[] calldata)
        external
        payable
        override
    {
        if (_shouldRevertOnUpdate) revert MockStorkInvalidSignature();
        // No-op in mock -- prices are set directly via setPrice
    }

    function getTemporalNumericValueV1(bytes32 id)
        external
        view
        override
        returns (StorkStructs.TemporalNumericValue memory)
    {
        StorkStructs.TemporalNumericValue memory val = _values[id];
        if (val.timestampNs == 0) revert MockStorkNotFound();
        return val;
    }

    function getUpdateFeeV1(StorkStructs.TemporalNumericValueInput[] calldata)
        external
        pure
        override
        returns (uint256)
    {
        return 0;
    }
}
