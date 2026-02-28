// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import {SimpleOracle} from "../src/oracle/SimpleOracle.sol";

/// @title DeployOracle -- Deploy SimpleOracle to Arc Testnet
/// @dev Run: forge script script/DeployOracle.s.sol:DeployOracle --rpc-url $ARC_RPC_URL --broadcast
contract DeployOracle is Script {
    // ETHUSD feed ID (same as CollateralManager.ETHUSD_FEED_ID)
    bytes32 constant ETHUSD_FEED_ID = 0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy SimpleOracle with deployer as owner
        SimpleOracle oracle = new SimpleOracle(deployer);
        console.log("SimpleOracle deployed at:", address(oracle));

        // 2. Set initial ETHUSD price: $2,500 (18 decimals)
        oracle.setPriceNow(ETHUSD_FEED_ID, int192(int256(2500e18)));
        console.log("ETHUSD price set to $2,500");

        vm.stopBroadcast();
    }
}
