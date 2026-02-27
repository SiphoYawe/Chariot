// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {CollateralManager} from "../src/core/CollateralManager.sol";
import {LendingPool} from "../src/core/LendingPool.sol";
import {ChariotVault} from "../src/core/ChariotVault.sol";
import {ChariotBase} from "../src/base/ChariotBase.sol";
import {InterestRateModel} from "../src/risk/InterestRateModel.sol";
import {IInterestRateModel} from "../src/interfaces/IInterestRateModel.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockStork} from "./mocks/MockStork.sol";
import {MockUSYCTeller} from "./mocks/MockUSYCTeller.sol";
import {BridgedETH} from "../src/bridge/BridgedETH.sol";
import {StorkStructs} from "@stork-oracle/StorkStructs.sol";

contract AdminControlsTest is Test {
    CollateralManager public collateralManager;
    LendingPool public pool;
    ChariotVault public vault;
    InterestRateModel public rateModel;
    MockERC20 public usdc;
    MockERC20 public usyc;
    MockStork public stork;
    MockUSYCTeller public teller;
    BridgedETH public bridgedETH;

    address public admin = makeAddr("admin");
    address public operator = makeAddr("operator");
    address public alice = makeAddr("alice");
    address public relayer = makeAddr("relayer");

    uint256 constant WAD = 1e18;
    uint256 constant USDC_UNIT = 1e6;
    bytes32 constant ETHUSD_FEED_ID = 0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160;

    function setUp() public {
        vm.warp(100_000);

        // Deploy tokens
        usdc = new MockERC20("USD Coin", "USDC", 6);
        usyc = new MockERC20("US Yield Coin", "USYC", 6);
        stork = new MockStork();
        teller = new MockUSYCTeller(address(usdc), address(usyc), 1e18);
        bridgedETH = new BridgedETH(admin, relayer);

        // Deploy core contracts
        rateModel = new InterestRateModel();
        vault = new ChariotVault(address(usdc), address(usyc), address(teller), address(stork), admin);
        collateralManager = new CollateralManager(address(bridgedETH), address(stork), admin);
        pool = new LendingPool(address(usdc), address(stork), admin);

        // Wire dependencies
        vm.startPrank(admin);
        pool.setInterestRateModel(address(rateModel));
        pool.setCollateralManager(address(collateralManager));
        pool.setVault(address(vault));
        collateralManager.setLendingPool(address(pool));
        vault.grantRole(vault.LENDING_POOL_ROLE(), address(pool));

        // Grant operator role
        collateralManager.grantRole(collateralManager.OPERATOR_ROLE(), operator);
        pool.grantRole(pool.OPERATOR_ROLE(), operator);
        vault.grantRole(vault.OPERATOR_ROLE(), operator);

        // Grant admin role to rateModel for setParameters
        // (rateModel grants admin to deployer, which is the test contract)
        vm.stopPrank();

        // Set ETH price
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(2000e18)));

        // Fund vault
        usdc.mint(address(this), 100_000 * USDC_UNIT);
        usdc.approve(address(vault), 100_000 * USDC_UNIT);
        vault.deposit(100_000 * USDC_UNIT, address(this));
    }

    // ========== addCollateralType Tests ==========

    function test_addCollateralType_succeedsWithValidConfig() public {
        address newToken = makeAddr("newToken");
        CollateralManager.CollateralConfig memory config = _defaultConfig();

        vm.prank(admin);
        collateralManager.addCollateralType(newToken, config);

        CollateralManager.CollateralConfig memory stored = collateralManager.getCollateralConfig(newToken);
        assertEq(stored.baseLTV, config.baseLTV);
        assertEq(stored.liquidationThreshold, config.liquidationThreshold);
        assertEq(stored.liquidationBonus, config.liquidationBonus);
        assertEq(stored.priceFeedId, config.priceFeedId);
        assertTrue(stored.isActive);
    }

    function test_addCollateralType_revertsForNonAdmin() public {
        address newToken = makeAddr("newToken");
        CollateralManager.CollateralConfig memory config = _defaultConfig();
        bytes32 adminRole = collateralManager.DEFAULT_ADMIN_ROLE();

        vm.expectRevert(
            abi.encodeWithSignature("AccessControlUnauthorizedAccount(address,bytes32)", alice, adminRole)
        );
        vm.prank(alice);
        collateralManager.addCollateralType(newToken, config);
    }

    function test_addCollateralType_revertsForDuplicateToken() public {
        address newToken = makeAddr("newToken");
        CollateralManager.CollateralConfig memory config = _defaultConfig();

        vm.startPrank(admin);
        collateralManager.addCollateralType(newToken, config);

        vm.expectRevert(CollateralManager.AssetAlreadyExists.selector);
        collateralManager.addCollateralType(newToken, config);
        vm.stopPrank();
    }

    function test_addCollateralType_revertsForZeroAddress() public {
        CollateralManager.CollateralConfig memory config = _defaultConfig();

        vm.prank(admin);
        vm.expectRevert(ChariotBase.ZeroAddress.selector);
        collateralManager.addCollateralType(address(0), config);
    }

    function test_addCollateralType_emitsEvent() public {
        address newToken = makeAddr("newToken");
        CollateralManager.CollateralConfig memory config = _defaultConfig();

        vm.expectEmit(true, false, false, true);
        emit CollateralManager.CollateralTypeAdded(newToken, config.baseLTV, config.liquidationThreshold, config.liquidationBonus);

        vm.prank(admin);
        collateralManager.addCollateralType(newToken, config);
    }

    function test_addCollateralType_updatesPriceFeedId() public {
        address newToken = makeAddr("newToken");
        bytes32 feedId = keccak256("BTCUSD");
        CollateralManager.CollateralConfig memory config = _defaultConfig();
        config.priceFeedId = feedId;

        vm.prank(admin);
        collateralManager.addCollateralType(newToken, config);

        assertEq(collateralManager.getPriceFeedId(newToken), feedId);
    }

    // ========== updateCollateralConfig Tests ==========

    function test_updateCollateralConfig_succeedsAndEmitsEvent() public {
        address newToken = makeAddr("newToken");
        CollateralManager.CollateralConfig memory config = _defaultConfig();

        vm.startPrank(admin);
        collateralManager.addCollateralType(newToken, config);

        // Update to new values
        config.baseLTV = 0.6e18;
        config.liquidationThreshold = 0.7e18;
        config.liquidationBonus = 0.1e18;

        vm.expectEmit(true, false, false, true);
        emit CollateralManager.CollateralConfigUpdated(newToken, 0.6e18, 0.7e18, 0.1e18);

        collateralManager.updateCollateralConfig(newToken, config);
        vm.stopPrank();

        CollateralManager.CollateralConfig memory updated = collateralManager.getCollateralConfig(newToken);
        assertEq(updated.baseLTV, 0.6e18);
        assertEq(updated.liquidationThreshold, 0.7e18);
        assertEq(updated.liquidationBonus, 0.1e18);
    }

    function test_updateCollateralConfig_revertsForNonExistentAsset() public {
        address randomToken = makeAddr("random");
        CollateralManager.CollateralConfig memory config = _defaultConfig();

        vm.prank(admin);
        vm.expectRevert(CollateralManager.AssetNotFound.selector);
        collateralManager.updateCollateralConfig(randomToken, config);
    }

    // ========== CollateralConfig Validation Tests ==========

    function test_addCollateralType_revertsForZeroLTV() public {
        address newToken = makeAddr("newToken");
        CollateralManager.CollateralConfig memory config = _defaultConfig();
        config.baseLTV = 0;

        vm.prank(admin);
        vm.expectRevert(CollateralManager.InvalidLTV.selector);
        collateralManager.addCollateralType(newToken, config);
    }

    function test_addCollateralType_revertsForLTVOver100() public {
        address newToken = makeAddr("newToken");
        CollateralManager.CollateralConfig memory config = _defaultConfig();
        config.baseLTV = 1.01e18;
        config.liquidationThreshold = 1.02e18;

        vm.prank(admin);
        vm.expectRevert(CollateralManager.InvalidLTV.selector);
        collateralManager.addCollateralType(newToken, config);
    }

    function test_addCollateralType_revertsForThresholdLessThanLTV() public {
        address newToken = makeAddr("newToken");
        CollateralManager.CollateralConfig memory config = _defaultConfig();
        config.liquidationThreshold = config.baseLTV; // Equal, not greater

        vm.prank(admin);
        vm.expectRevert(CollateralManager.InvalidThreshold.selector);
        collateralManager.addCollateralType(newToken, config);
    }

    function test_addCollateralType_revertsForZeroBonus() public {
        address newToken = makeAddr("newToken");
        CollateralManager.CollateralConfig memory config = _defaultConfig();
        config.liquidationBonus = 0;

        vm.prank(admin);
        vm.expectRevert(CollateralManager.InvalidBonus.selector);
        collateralManager.addCollateralType(newToken, config);
    }

    function test_addCollateralType_revertsForBonusOver50() public {
        address newToken = makeAddr("newToken");
        CollateralManager.CollateralConfig memory config = _defaultConfig();
        config.liquidationBonus = 0.51e18;

        vm.prank(admin);
        vm.expectRevert(CollateralManager.InvalidBonus.selector);
        collateralManager.addCollateralType(newToken, config);
    }

    function test_addCollateralType_revertsForZeroPriceFeedId() public {
        address newToken = makeAddr("newToken");
        CollateralManager.CollateralConfig memory config = _defaultConfig();
        config.priceFeedId = bytes32(0);

        vm.prank(admin);
        vm.expectRevert(ChariotBase.OracleFeedNotConfigured.selector);
        collateralManager.addCollateralType(newToken, config);
    }

    // ========== getCollateralConfig / getSupportedCollateralTokens Tests ==========

    function test_getCollateralConfig_returnsCorrectValues() public {
        address newToken = makeAddr("newToken");
        CollateralManager.CollateralConfig memory config = _defaultConfig();

        vm.prank(admin);
        collateralManager.addCollateralType(newToken, config);

        CollateralManager.CollateralConfig memory stored = collateralManager.getCollateralConfig(newToken);
        assertEq(stored.baseLTV, 0.75e18);
        assertEq(stored.liquidationThreshold, 0.82e18);
        assertEq(stored.liquidationBonus, 0.05e18);
        assertEq(stored.priceFeedId, ETHUSD_FEED_ID);
        assertTrue(stored.isActive);
    }

    function test_getSupportedCollateralTokens_returnsAllAddedTokens() public {
        address tokenA = makeAddr("tokenA");
        address tokenB = makeAddr("tokenB");
        CollateralManager.CollateralConfig memory config = _defaultConfig();

        vm.startPrank(admin);
        collateralManager.addCollateralType(tokenA, config);

        config.priceFeedId = keccak256("BTCUSD");
        collateralManager.addCollateralType(tokenB, config);
        vm.stopPrank();

        address[] memory tokens = collateralManager.getSupportedCollateralTokens();
        assertEq(tokens.length, 2);
        assertEq(tokens[0], tokenA);
        assertEq(tokens[1], tokenB);
    }

    // ========== setRateModelParameters Tests ==========

    function test_setParameters_updatesValues() public {
        // rateModel deployer is address(this), which has admin role
        rateModel.setParameters(0.85e18, 0.05e18, 0.8e18, 0.15e18);

        assertEq(rateModel.uOptimal(), 0.85e18);
        assertEq(rateModel.rSlope1(), 0.05e18);
        assertEq(rateModel.rSlope2(), 0.8e18);
        assertEq(rateModel.reserveFactor(), 0.15e18);
    }

    function test_setParameters_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit InterestRateModel.RateModelParametersUpdated(0.85e18, 0.05e18, 0.8e18, 0.15e18);

        rateModel.setParameters(0.85e18, 0.05e18, 0.8e18, 0.15e18);
    }

    function test_setParameters_affectsBorrowRate() public {
        // Default: at 80% util, rate = 4%
        uint256 defaultRate = rateModel.getBorrowRate(0.8e18);
        assertEq(defaultRate, 0.04e18);

        // Change slope1 to 8%
        rateModel.setParameters(0.8e18, 0.08e18, 0.75e18, 0.1e18);

        // At 80% util, rate should now be 8%
        uint256 newRate = rateModel.getBorrowRate(0.8e18);
        assertEq(newRate, 0.08e18);
    }

    function test_setParameters_revertsForNonAdmin() public {
        bytes32 adminRole = rateModel.DEFAULT_ADMIN_ROLE();

        vm.expectRevert(
            abi.encodeWithSignature("AccessControlUnauthorizedAccount(address,bytes32)", alice, adminRole)
        );
        vm.prank(alice);
        rateModel.setParameters(0.8e18, 0.04e18, 0.75e18, 0.1e18);
    }

    function test_setParameters_revertsForZeroOptimalUtilisation() public {
        vm.expectRevert(InterestRateModel.InvalidOptimalUtilisation.selector);
        rateModel.setParameters(0, 0.04e18, 0.75e18, 0.1e18);
    }

    function test_setParameters_revertsForOptimalOver100() public {
        vm.expectRevert(InterestRateModel.InvalidOptimalUtilisation.selector);
        rateModel.setParameters(1.01e18, 0.04e18, 0.75e18, 0.1e18);
    }

    function test_setParameters_revertsForZeroSlope1() public {
        vm.expectRevert(InterestRateModel.InvalidSlope.selector);
        rateModel.setParameters(0.8e18, 0, 0.75e18, 0.1e18);
    }

    function test_setParameters_revertsForZeroSlope2() public {
        vm.expectRevert(InterestRateModel.InvalidSlope.selector);
        rateModel.setParameters(0.8e18, 0.04e18, 0, 0.1e18);
    }

    function test_setParameters_revertsForReserveFactorOver100() public {
        vm.expectRevert(InterestRateModel.InvalidReserveFactor.selector);
        rateModel.setParameters(0.8e18, 0.04e18, 0.75e18, 1e18);
    }

    // ========== Circuit Breaker Tests ==========

    function test_triggerCircuitBreaker_level1_pausesBorrows() public {
        // Deposit collateral for alice
        vm.prank(relayer);
        bridgedETH.mint(alice, 5 ether, 1);
        vm.startPrank(alice);
        bridgedETH.approve(address(collateralManager), 5 ether);
        collateralManager.depositCollateral(address(bridgedETH), 5 ether);
        vm.stopPrank();

        // Trigger circuit breaker level 1 on the pool (each contract has its own CB level)
        vm.prank(operator);
        pool.triggerCircuitBreaker(1);

        // Borrow should revert (whenBorrowingAllowed modifier on pool)
        StorkStructs.TemporalNumericValueInput[] memory empty = new StorkStructs.TemporalNumericValueInput[](0);
        vm.prank(alice);
        vm.expectRevert(ChariotBase.BorrowingPaused.selector);
        pool.borrow(address(bridgedETH), 100 * USDC_UNIT, empty);
    }

    function test_triggerCircuitBreaker_level3_pausesAllOperations() public {
        // Trigger circuit breaker level 3
        vm.prank(operator);
        collateralManager.triggerCircuitBreaker(3);

        // Deposit should revert (whenNotPaused modifier)
        vm.prank(relayer);
        bridgedETH.mint(alice, 5 ether, 1);
        vm.prank(alice);
        bridgedETH.approve(address(collateralManager), 5 ether);

        vm.prank(alice);
        vm.expectRevert(ChariotBase.CircuitBreakerActive.selector);
        collateralManager.depositCollateral(address(bridgedETH), 5 ether);
    }

    function test_triggerCircuitBreaker_emitsEvent() public {
        vm.expectEmit(false, true, false, true);
        emit ChariotBase.CircuitBreakerTriggered(2, operator);

        vm.prank(operator);
        collateralManager.triggerCircuitBreaker(2);
    }

    function test_triggerCircuitBreaker_revertsForNonOperator() public {
        bytes32 operatorRole = collateralManager.OPERATOR_ROLE();

        vm.expectRevert(
            abi.encodeWithSignature("AccessControlUnauthorizedAccount(address,bytes32)", alice, operatorRole)
        );
        vm.prank(alice);
        collateralManager.triggerCircuitBreaker(1);
    }

    function test_triggerCircuitBreaker_revertsForLevel0() public {
        vm.prank(operator);
        vm.expectRevert(ChariotBase.InvalidCircuitBreakerLevel.selector);
        collateralManager.triggerCircuitBreaker(0);
    }

    function test_triggerCircuitBreaker_revertsForLevel4() public {
        vm.prank(operator);
        vm.expectRevert(ChariotBase.InvalidCircuitBreakerLevel.selector);
        collateralManager.triggerCircuitBreaker(4);
    }

    function test_resumeCircuitBreaker_resetsToNormal() public {
        // Trigger level 1
        vm.prank(operator);
        collateralManager.triggerCircuitBreaker(1);
        assertEq(collateralManager.circuitBreakerLevel(), 1);

        // Resume (admin only)
        vm.prank(admin);
        collateralManager.resumeCircuitBreaker();
        assertEq(collateralManager.circuitBreakerLevel(), 0);
    }

    function test_resumeCircuitBreaker_emitsEvent() public {
        vm.prank(operator);
        collateralManager.triggerCircuitBreaker(1);

        vm.expectEmit(true, false, false, true);
        emit ChariotBase.CircuitBreakerResumed(admin);

        vm.prank(admin);
        collateralManager.resumeCircuitBreaker();
    }

    function test_resumeCircuitBreaker_revertsForNonAdmin() public {
        vm.prank(operator);
        collateralManager.triggerCircuitBreaker(1);

        bytes32 adminRole = collateralManager.DEFAULT_ADMIN_ROLE();
        vm.expectRevert(
            abi.encodeWithSignature("AccessControlUnauthorizedAccount(address,bytes32)", operator, adminRole)
        );
        vm.prank(operator);
        collateralManager.resumeCircuitBreaker();
    }

    function test_resumeCircuitBreaker_allowsOperationsAgain() public {
        // Trigger level 3 (emergency)
        vm.prank(operator);
        collateralManager.triggerCircuitBreaker(3);

        // Resume
        vm.prank(admin);
        collateralManager.resumeCircuitBreaker();

        // Now deposits should work again
        vm.prank(relayer);
        bridgedETH.mint(alice, 1 ether, 1);
        vm.startPrank(alice);
        bridgedETH.approve(address(collateralManager), 1 ether);
        collateralManager.depositCollateral(address(bridgedETH), 1 ether);
        vm.stopPrank();

        assertEq(collateralManager.getCollateralBalance(alice, address(bridgedETH)), 1 ether);
    }

    // ========== Circuit Breaker Level Tests ==========

    function test_circuitBreakerLevel_level1_allowsDepositsButNotBorrows() public {
        vm.prank(operator);
        collateralManager.triggerCircuitBreaker(1);

        // Deposits should still work (whenNotPaused passes for level < 3)
        vm.prank(relayer);
        bridgedETH.mint(alice, 1 ether, 1);
        vm.startPrank(alice);
        bridgedETH.approve(address(collateralManager), 1 ether);
        collateralManager.depositCollateral(address(bridgedETH), 1 ether);
        vm.stopPrank();

        assertEq(collateralManager.getCollateralBalance(alice, address(bridgedETH)), 1 ether);
    }

    function test_circuitBreakerLevel_readablePublicly() public {
        assertEq(collateralManager.circuitBreakerLevel(), 0);

        vm.prank(operator);
        collateralManager.triggerCircuitBreaker(2);
        assertEq(collateralManager.circuitBreakerLevel(), 2);
    }

    // ========== Role Constants Tests ==========

    function test_roleConstants_exist() public view {
        // Verify roles are properly defined
        bytes32 operatorRole = collateralManager.OPERATOR_ROLE();
        bytes32 lendingPoolRole = collateralManager.LENDING_POOL_ROLE();
        bytes32 liquidationEngineRole = collateralManager.LIQUIDATION_ENGINE_ROLE();

        assertTrue(operatorRole != bytes32(0));
        assertTrue(lendingPoolRole != bytes32(0));
        assertTrue(liquidationEngineRole != bytes32(0));
    }

    // ========== InterestRateModel Default Values ==========

    function test_rateModel_defaultValues() public view {
        assertEq(rateModel.rBase(), 0, "Default base rate should be 0%");
        assertEq(rateModel.rSlope1(), 0.04e18, "Default slope1 should be 4%");
        assertEq(rateModel.rSlope2(), 0.75e18, "Default slope2 should be 75%");
        assertEq(rateModel.uOptimal(), 0.8e18, "Default optimal utilisation should be 80%");
        assertEq(rateModel.reserveFactor(), 0.1e18, "Default reserve factor should be 10%");
    }

    // ========== Helpers ==========

    function _defaultConfig() internal pure returns (CollateralManager.CollateralConfig memory) {
        return CollateralManager.CollateralConfig({
            baseLTV: 0.75e18,
            liquidationThreshold: 0.82e18,
            liquidationBonus: 0.05e18,
            priceFeedId: ETHUSD_FEED_ID,
            volatilityFeedId: bytes32(0),
            isActive: true
        });
    }
}
