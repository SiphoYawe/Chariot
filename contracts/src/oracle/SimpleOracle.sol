// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {StorkStructs} from "@stork-oracle/StorkStructs.sol";
import {IStork} from "../interfaces/IStork.sol";

/// @title SimpleOracle -- Admin-controlled price oracle implementing the IStork interface
/// @notice Replaces Stork pull-oracle for environments without Stork API access.
///         Owner sets prices via setPriceNow(); consumers read via getTemporalNumericValueV1().
/// @dev Drop-in replacement: same IStork interface, no signed data required.
contract SimpleOracle is Ownable, IStork {
    error PriceNotSet();

    mapping(bytes32 => StorkStructs.TemporalNumericValue) private _values;

    constructor(address owner_) Ownable(owner_) {}

    /// @notice Set a price value for a feed with explicit timestamp
    /// @param id The feed ID (e.g., ETHUSD_FEED_ID)
    /// @param value The price value (int192, 18 decimals)
    /// @param timestampNs The timestamp in nanoseconds
    function setPrice(bytes32 id, int192 value, uint64 timestampNs) external onlyOwner {
        _values[id] = StorkStructs.TemporalNumericValue({timestampNs: timestampNs, quantizedValue: value});
    }

    /// @notice Set a price with current block timestamp
    /// @param id The feed ID
    /// @param value The price value (int192, 18 decimals)
    function setPriceNow(bytes32 id, int192 value) external onlyOwner {
        _values[id] =
            StorkStructs.TemporalNumericValue({timestampNs: uint64(block.timestamp) * 1e9, quantizedValue: value});
    }

    /// @notice No-op -- prices are set directly via setPrice/setPriceNow
    function updateTemporalNumericValuesV1(StorkStructs.TemporalNumericValueInput[] calldata)
        external
        payable
        override
    {
        // No-op: callers can pass empty arrays safely
    }

    /// @notice Read the latest price for a feed
    function getTemporalNumericValueV1(bytes32 id)
        external
        view
        override
        returns (StorkStructs.TemporalNumericValue memory)
    {
        StorkStructs.TemporalNumericValue memory val = _values[id];
        if (val.timestampNs == 0) revert PriceNotSet();
        return val;
    }

    /// @notice No fee required for admin-set prices
    function getUpdateFeeV1(StorkStructs.TemporalNumericValueInput[] calldata)
        external
        pure
        override
        returns (uint256)
    {
        return 0;
    }
}
