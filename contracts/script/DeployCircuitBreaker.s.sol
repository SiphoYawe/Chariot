// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {CircuitBreaker} from "../src/risk/CircuitBreaker.sol";
import {ChariotBase} from "../src/base/ChariotBase.sol";

/// @title DeployCircuitBreaker -- Deploy and wire CircuitBreaker to existing Chariot contracts
/// @dev Run on Arc Testnet:
///   forge script script/DeployCircuitBreaker.s.sol:DeployCircuitBreaker \
///     --rpc-url $ARC_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast -vvv
contract DeployCircuitBreaker is Script {
    // Deployed contract addresses (Arc Testnet)
    address constant CHARIOT_VAULT = 0x21dBa2FDC65E4910a2C34147929294f88c2D8E43;
    address constant LENDING_POOL = 0xD00FbD24E77C902F5224981d6c5cA3e1F9EfB318;
    address constant COLLATERAL_MANAGER = 0xeb5343dDDb1Ab728636931c5Ade7B82Af6aca4A6;
    address constant LIQUIDATION_ENGINE = 0xDd8C98E2D0dC38385094CC85cfCf94e422ff9472;

    function run() external {
        address deployer = msg.sender;

        vm.startBroadcast();

        // 1. Deploy CircuitBreaker with deployer as admin (also gets OPERATOR_ROLE)
        CircuitBreaker cb = new CircuitBreaker(deployer);
        console.log("CircuitBreaker deployed at:", address(cb));

        // 2. Grant RECORDER_ROLE to protocol contracts so they can feed metrics
        bytes32 recorderRole = cb.RECORDER_ROLE();
        cb.grantRole(recorderRole, CHARIOT_VAULT);
        cb.grantRole(recorderRole, LENDING_POOL);
        cb.grantRole(recorderRole, COLLATERAL_MANAGER);
        cb.grantRole(recorderRole, LIQUIDATION_ENGINE);
        console.log("RECORDER_ROLE granted to ChariotVault, LendingPool, CollateralManager, LiquidationEngine");

        // 3. Wire CircuitBreaker into each ChariotBase-inheriting contract
        ChariotBase(CHARIOT_VAULT).setCircuitBreaker(address(cb));
        ChariotBase(LENDING_POOL).setCircuitBreaker(address(cb));
        ChariotBase(COLLATERAL_MANAGER).setCircuitBreaker(address(cb));
        ChariotBase(LIQUIDATION_ENGINE).setCircuitBreaker(address(cb));
        console.log("CircuitBreaker wired to all protocol contracts");

        vm.stopBroadcast();

        // Print summary
        console.log("\n=== CIRCUIT BREAKER DEPLOYMENT SUMMARY (Arc Testnet) ===");
        console.log("CircuitBreaker:      ", address(cb));
        console.log("Admin (DEFAULT_ADMIN):", deployer);
        console.log("Operator:            ", deployer);
        console.log("");
        console.log("Wired to:");
        console.log("  ChariotVault:      ", CHARIOT_VAULT);
        console.log("  LendingPool:       ", LENDING_POOL);
        console.log("  CollateralManager: ", COLLATERAL_MANAGER);
        console.log("  LiquidationEngine: ", LIQUIDATION_ENGINE);
    }
}
