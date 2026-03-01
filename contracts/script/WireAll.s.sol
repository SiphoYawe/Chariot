// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {ChariotVault} from "../src/core/ChariotVault.sol";
import {LendingPool} from "../src/core/LendingPool.sol";
import {CollateralManager} from "../src/core/CollateralManager.sol";
import {LiquidationEngine} from "../src/core/LiquidationEngine.sol";
import {InterestRateModel} from "../src/risk/InterestRateModel.sol";
import {RiskParameterEngine} from "../src/risk/RiskParameterEngine.sol";
import {CircuitBreaker} from "../src/risk/CircuitBreaker.sol";
import {BridgedETH} from "../src/bridge/BridgedETH.sol";

/// @title WireAll -- Wires all deployed Chariot contracts together
/// @dev Run on Arc Testnet:
///   forge script script/WireAll.s.sol:WireAll \
///     --rpc-url $ARC_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast -vvv
contract WireAll is Script {
    // -- Deployed Contract Addresses (Arc Testnet, chain 5042002) --
    address constant BRIDGED_ETH = 0x42cAA0a88A42b92e1307E625e5253BE0dFABcCc2;
    address constant INTEREST_RATE_MODEL = 0x2AFF3e043f8677752aA8FDF2be6cFD1F6408De1c;
    address constant RISK_PARAMETER_ENGINE = 0x28F88F70fBc07c45C143d1Bc3dBAc426C14Ce4eA;
    address constant CHARIOT_VAULT = 0x21dBa2FDC65E4910a2C34147929294f88c2D8E43;
    address constant COLLATERAL_MANAGER = 0xeb5343dDDb1Ab728636931c5Ade7B82Af6aca4A6;
    address constant LENDING_POOL = 0xD00FbD24E77C902F5224981d6c5cA3e1F9EfB318;
    address constant LIQUIDATION_ENGINE = 0xDd8C98E2D0dC38385094CC85cfCf94e422ff9472;
    address constant CIRCUIT_BREAKER = 0x7Ba752d4eF5350B2F187Fa093C4ec4495104AC14;

    // -- Role Hashes --
    bytes32 constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 constant LENDING_POOL_ROLE = keccak256("LENDING_POOL_ROLE");
    bytes32 constant LIQUIDATION_ENGINE_ROLE = keccak256("LIQUIDATION_ENGINE_ROLE");
    bytes32 constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    function run() external {
        address deployer = msg.sender;

        vm.startBroadcast();

        // == Phase 1: Core Contract Dependency Wiring ==
        console.log("=== Phase 1: Wiring Core Dependencies ===");

        // 1a. LendingPool -> InterestRateModel, CollateralManager, Vault, PrimaryCollateral
        LendingPool pool = LendingPool(LENDING_POOL);
        pool.setInterestRateModel(INTEREST_RATE_MODEL);
        console.log("  LendingPool.setInterestRateModel OK");

        pool.setCollateralManager(COLLATERAL_MANAGER);
        console.log("  LendingPool.setCollateralManager OK");

        pool.setVault(CHARIOT_VAULT);
        console.log("  LendingPool.setVault OK");

        pool.setPrimaryCollateralToken(BRIDGED_ETH);
        console.log("  LendingPool.setPrimaryCollateralToken OK");

        // 1b. CollateralManager -> LendingPool, RiskParameterEngine
        CollateralManager collateral = CollateralManager(COLLATERAL_MANAGER);
        collateral.setLendingPool(LENDING_POOL);
        console.log("  CollateralManager.setLendingPool OK");

        collateral.setRiskParameterEngine(RISK_PARAMETER_ENGINE);
        console.log("  CollateralManager.setRiskParameterEngine OK");

        // 1c. LiquidationEngine -> LendingPool, CollateralManager, Vault
        LiquidationEngine liquidation = LiquidationEngine(LIQUIDATION_ENGINE);
        liquidation.setLendingPool(LENDING_POOL);
        console.log("  LiquidationEngine.setLendingPool OK");

        liquidation.setCollateralManager(COLLATERAL_MANAGER);
        console.log("  LiquidationEngine.setCollateralManager OK");

        liquidation.setVault(CHARIOT_VAULT);
        console.log("  LiquidationEngine.setVault OK");

        // == Phase 2: Role Grants ==
        console.log("\n=== Phase 2: Granting Roles ===");

        // 2a. ChariotVault: grant LENDING_POOL_ROLE to LendingPool
        ChariotVault vault = ChariotVault(CHARIOT_VAULT);
        vault.grantRole(LENDING_POOL_ROLE, LENDING_POOL);
        console.log("  ChariotVault.grantRole(LENDING_POOL_ROLE, LendingPool) OK");

        // 2b. LendingPool: grant LIQUIDATION_ENGINE_ROLE to LiquidationEngine
        pool.grantRole(LIQUIDATION_ENGINE_ROLE, LIQUIDATION_ENGINE);
        console.log("  LendingPool.grantRole(LIQUIDATION_ENGINE_ROLE, LiquidationEngine) OK");

        // 2c. CollateralManager: grant LIQUIDATION_ENGINE_ROLE to LiquidationEngine
        collateral.grantRole(LIQUIDATION_ENGINE_ROLE, LIQUIDATION_ENGINE);
        console.log("  CollateralManager.grantRole(LIQUIDATION_ENGINE_ROLE, LiquidationEngine) OK");

        // 2d. CircuitBreaker: grant RECORDER_ROLE to core contracts
        CircuitBreaker cb = CircuitBreaker(CIRCUIT_BREAKER);
        cb.grantRole(RECORDER_ROLE, COLLATERAL_MANAGER);
        console.log("  CircuitBreaker.grantRole(RECORDER_ROLE, CollateralManager) OK");

        cb.grantRole(RECORDER_ROLE, CHARIOT_VAULT);
        console.log("  CircuitBreaker.grantRole(RECORDER_ROLE, ChariotVault) OK");

        cb.grantRole(RECORDER_ROLE, LENDING_POOL);
        console.log("  CircuitBreaker.grantRole(RECORDER_ROLE, LendingPool) OK");

        // 2e. Grant OPERATOR_ROLE to deployer for circuit breaker manual control
        cb.grantRole(OPERATOR_ROLE, deployer);
        console.log("  CircuitBreaker.grantRole(OPERATOR_ROLE, deployer) OK");

        // == Phase 3: Circuit Breaker Integration ==
        console.log("\n=== Phase 3: Circuit Breaker Integration ===");

        pool.setCircuitBreaker(CIRCUIT_BREAKER);
        console.log("  LendingPool.setCircuitBreaker OK");

        collateral.setCircuitBreaker(CIRCUIT_BREAKER);
        console.log("  CollateralManager.setCircuitBreaker OK");

        liquidation.setCircuitBreaker(CIRCUIT_BREAKER);
        console.log("  LiquidationEngine.setCircuitBreaker OK");

        vault.setCircuitBreaker(CIRCUIT_BREAKER);
        console.log("  ChariotVault.setCircuitBreaker OK");

        vm.stopBroadcast();

        // Print summary
        console.log("\n=== WIRING COMPLETE ===");
        console.log("All inter-contract dependencies and role grants configured.");
        console.log("Deployer (admin):", deployer);
        console.log("\nNote: CCTPBridge not yet deployed. Run separately when ready:");
        console.log("  pool.setCCTPBridge(cctpBridgeAddress)");
    }
}
