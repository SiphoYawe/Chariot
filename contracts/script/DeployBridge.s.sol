// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {ETHEscrow} from "../src/bridge/ETHEscrow.sol";

/// @title DeployBridge -- Deploys bridge contracts
/// @dev ETHEscrow on Ethereum Sepolia, BridgedETH on Arc Testnet (separate invocations)
contract DeployBridge is Script {
    function run() external {
        address relayer = vm.envAddress("RELAYER_ADDRESS");

        vm.startBroadcast();

        ETHEscrow escrow = new ETHEscrow(relayer);
        console.log("ETHEscrow deployed at:", address(escrow));
        console.log("Relayer address:", relayer);

        vm.stopBroadcast();
    }
}
