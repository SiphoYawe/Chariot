// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {ETHEscrow} from "../src/bridge/ETHEscrow.sol";
import {BridgedETH} from "../src/bridge/BridgedETH.sol";

/// @title DeployBridge -- Deploys bridge contracts
/// @dev Run with different RPC URLs for each chain:
///   ETHEscrow: forge script --rpc-url $ETH_SEPOLIA_RPC_URL
///   BridgedETH: forge script --rpc-url $ARC_RPC_URL
contract DeployBridge is Script {
    function deployEscrow() external {
        address relayer = vm.envAddress("RELAYER_ADDRESS");
        vm.startBroadcast();

        ETHEscrow escrow = new ETHEscrow(relayer);
        console.log("ETHEscrow deployed at:", address(escrow));

        vm.stopBroadcast();
    }

    function deployBridgedETH() external {
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address minter = vm.envAddress("RELAYER_ADDRESS");
        vm.startBroadcast();

        BridgedETH token = new BridgedETH(admin, minter);
        console.log("BridgedETH deployed at:", address(token));

        vm.stopBroadcast();
    }

    function run() external {
        // Default: deploy both (caller picks chain via --rpc-url)
        address relayer = vm.envAddress("RELAYER_ADDRESS");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        vm.startBroadcast();

        ETHEscrow escrow = new ETHEscrow(relayer);
        console.log("ETHEscrow deployed at:", address(escrow));

        BridgedETH token = new BridgedETH(admin, relayer);
        console.log("BridgedETH deployed at:", address(token));

        vm.stopBroadcast();
    }
}
