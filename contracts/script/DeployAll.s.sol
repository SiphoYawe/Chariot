// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {ChariotVault} from "../src/core/ChariotVault.sol";
import {LendingPool} from "../src/core/LendingPool.sol";
import {CollateralManager} from "../src/core/CollateralManager.sol";
import {LiquidationEngine} from "../src/core/LiquidationEngine.sol";
import {InterestRateModel} from "../src/risk/InterestRateModel.sol";
import {RiskParameterEngine} from "../src/risk/RiskParameterEngine.sol";
import {BridgedETH} from "../src/bridge/BridgedETH.sol";

/// @title DeployAll -- Deploys all Arc-side Chariot contracts
/// @dev Run on Arc Testnet:
///   forge script script/DeployAll.s.sol:DeployAll \
///     --rpc-url $ARC_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast -vvv
contract DeployAll is Script {
    // Arc Testnet known addresses
    address constant USDC = 0x3600000000000000000000000000000000000000;
    address constant USYC = 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C;
    address constant USYC_TELLER = 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A;
    address constant STORK_ORACLE = 0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62;

    function run() external {
        address deployer = msg.sender;
        address relayer = vm.envAddress("RELAYER_ADDRESS");

        vm.startBroadcast();

        // 1. BridgedETH (needed by CollateralManager)
        BridgedETH bridgedETH = new BridgedETH(deployer, relayer);
        console.log("BridgedETH:", address(bridgedETH));

        // 2. InterestRateModel (no constructor args)
        InterestRateModel rateModel = new InterestRateModel();
        console.log("InterestRateModel:", address(rateModel));

        // 3. RiskParameterEngine(storkOracle, admin)
        RiskParameterEngine riskEngine = new RiskParameterEngine(STORK_ORACLE, deployer);
        console.log("RiskParameterEngine:", address(riskEngine));

        // 4. ChariotVault(usdc, usyc, usycTeller, storkOracle, admin)
        ChariotVault vault = new ChariotVault(USDC, USYC, USYC_TELLER, STORK_ORACLE, deployer);
        console.log("ChariotVault:", address(vault));

        // 5. CollateralManager(bridgedETH, storkOracle, admin)
        CollateralManager collateral = new CollateralManager(address(bridgedETH), STORK_ORACLE, deployer);
        console.log("CollateralManager:", address(collateral));

        // 6. LendingPool(usdc, storkOracle, admin)
        LendingPool pool = new LendingPool(USDC, STORK_ORACLE, deployer);
        console.log("LendingPool:", address(pool));

        // 7. LiquidationEngine(usdc, storkOracle, admin)
        LiquidationEngine liquidation = new LiquidationEngine(USDC, STORK_ORACLE, deployer);
        console.log("LiquidationEngine:", address(liquidation));

        vm.stopBroadcast();

        // Print summary
        console.log("\n=== DEPLOYMENT SUMMARY (Arc Testnet) ===");
        console.log("BridgedETH:          ", address(bridgedETH));
        console.log("InterestRateModel:   ", address(rateModel));
        console.log("RiskParameterEngine: ", address(riskEngine));
        console.log("ChariotVault:        ", address(vault));
        console.log("CollateralManager:   ", address(collateral));
        console.log("LendingPool:         ", address(pool));
        console.log("LiquidationEngine:   ", address(liquidation));
    }
}
