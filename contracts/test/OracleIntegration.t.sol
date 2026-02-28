// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {CollateralManager} from "../src/core/CollateralManager.sol";
import {LendingPool} from "../src/core/LendingPool.sol";
import {LiquidationEngine} from "../src/core/LiquidationEngine.sol";
import {ChariotVault} from "../src/core/ChariotVault.sol";
import {ChariotBase} from "../src/base/ChariotBase.sol";
import {InterestRateModel} from "../src/risk/InterestRateModel.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockStork} from "./mocks/MockStork.sol";
import {MockUSYCTeller} from "./mocks/MockUSYCTeller.sol";
import {BridgedETH} from "../src/bridge/BridgedETH.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StorkStructs} from "@stork-oracle/StorkStructs.sol";

contract OracleIntegrationTest is Test {
    CollateralManager public collateralManager;
    LendingPool public pool;
    LiquidationEngine public liquidationEngine;
    ChariotVault public vault;
    InterestRateModel public rateModel;
    MockERC20 public usdc;
    MockERC20 public usyc;
    MockStork public stork;
    MockUSYCTeller public teller;
    BridgedETH public bridgedETH;

    address public admin = makeAddr("admin");
    address public alice = makeAddr("alice");
    address public relayer = makeAddr("relayer");

    uint256 constant USDC_UNIT = 1e6;
    uint256 constant WAD = 1e18;
    int192 constant ETH_PRICE = 2000e18;
    bytes32 constant ETHUSD_FEED_ID = 0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160;

    StorkStructs.TemporalNumericValueInput[] emptyUpdates;

    function setUp() public {
        // Warp to a realistic timestamp so staleness calculations don't underflow
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
        liquidationEngine = new LiquidationEngine(address(usdc), address(stork), admin);

        // Wire dependencies
        vm.startPrank(admin);
        pool.setInterestRateModel(address(rateModel));
        pool.setCollateralManager(address(collateralManager));
        pool.setVault(address(vault));
        collateralManager.setLendingPool(address(pool));
        liquidationEngine.setLendingPool(address(pool));
        liquidationEngine.setCollateralManager(address(collateralManager));
        liquidationEngine.setVault(address(vault));

        // Grant roles
        vault.grantRole(vault.LENDING_POOL_ROLE(), address(pool));
        pool.grantRole(pool.LIQUIDATION_ENGINE_ROLE(), address(liquidationEngine));
        collateralManager.grantRole(collateralManager.LIQUIDATION_ENGINE_ROLE(), address(liquidationEngine));
        vm.stopPrank();

        // Set ETH price to $2000
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);

        // Fund vault with USDC
        usdc.mint(address(this), 100_000 * USDC_UNIT);
        usdc.approve(address(vault), 100_000 * USDC_UNIT);
        vault.deposit(100_000 * USDC_UNIT, address(this));
    }

    // ========== Oracle Price Update Tests ==========

    function test_oraclePriceUpdate_succeedsWithValidData() public {
        // Update price via oracle
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(2500e18)));

        // Verify CollateralManager reads the updated price
        uint256 ethPrice = collateralManager.getETHPrice();
        assertEq(ethPrice, 2500e18, "Price should be updated to $2500");
    }

    function test_oraclePriceUpdate_revertsWithInvalidSignature() public {
        // Configure mock to revert (simulates invalid ECDSA signature)
        stork.setShouldRevertOnUpdate(true);

        // Mint collateral for alice
        vm.prank(relayer);
        bridgedETH.mint(alice, 5 ether, 1);
        vm.startPrank(alice);
        bridgedETH.approve(address(collateralManager), 5 ether);
        collateralManager.depositCollateral(address(bridgedETH), 5 ether);
        vm.stopPrank();

        // Create non-empty price updates to trigger the update
        StorkStructs.TemporalNumericValueInput[] memory updates = new StorkStructs.TemporalNumericValueInput[](1);
        updates[0] = StorkStructs.TemporalNumericValueInput({
            temporalNumericValue: StorkStructs.TemporalNumericValue({
                timestampNs: uint64(block.timestamp) * 1e9, quantizedValue: int192(int256(2000e18))
            }),
            id: ETHUSD_FEED_ID,
            publisherMerkleRoot: bytes32(0),
            valueComputeAlgHash: bytes32(0),
            r: bytes32(0),
            s: bytes32(0),
            v: 27
        });

        // Borrow attempt with invalid signature should revert
        vm.prank(alice);
        vm.expectRevert(MockStork.MockStorkInvalidSignature.selector);
        pool.borrow(address(bridgedETH), 100 * USDC_UNIT, updates);
    }

    // ========== Staleness Tests ==========

    function test_stalenessCheck_acceptsFreshData() public view {
        // Default price is set at block.timestamp (fresh)
        uint256 ethPrice = collateralManager.getETHPrice();
        assertGt(ethPrice, 0, "Fresh price should be returned");
    }

    function test_stalenessCheck_rejectsDataOlderThan3600Seconds() public {
        // Set price with old timestamp
        uint256 staleTimestamp = block.timestamp - 3601; // 1 second past staleness
        stork.setPrice(ETHUSD_FEED_ID, ETH_PRICE, uint64(staleTimestamp) * 1e9);

        // Stale price should return 0 (CollateralManager's _getETHPrice returns 0 for stale)
        uint256 ethPrice = collateralManager.getETHPrice();
        assertEq(ethPrice, 0, "Stale price should return 0");
    }

    function test_stalenessCheck_acceptsDataWithin3600Seconds() public {
        // Set price at 3599 seconds ago (just within threshold)
        uint256 freshTimestamp = block.timestamp - 3599;
        stork.setPrice(ETHUSD_FEED_ID, ETH_PRICE, uint64(freshTimestamp) * 1e9);

        uint256 ethPrice = collateralManager.getETHPrice();
        assertEq(ethPrice, uint256(uint192(ETH_PRICE)), "Price within threshold should be accepted");
    }

    function test_stalenessCheck_exactBoundary() public {
        // Set price exactly at 3600 seconds ago
        uint256 boundaryTimestamp = block.timestamp - 3600;
        stork.setPrice(ETHUSD_FEED_ID, ETH_PRICE, uint64(boundaryTimestamp) * 1e9);

        // Exactly at threshold: block.timestamp - priceTimestamp == 3600, NOT > 3600
        uint256 ethPrice = collateralManager.getETHPrice();
        assertEq(ethPrice, uint256(uint192(ETH_PRICE)), "Price at exact boundary should be accepted");
    }

    // ========== Stork Oracle Address Tests ==========

    function test_storkOracleAddress_isConfigured() public view {
        assertEq(collateralManager.storkOracle(), address(stork), "Stork oracle should be configured");
    }

    function test_storkOracleAddress_adminCanUpdate() public {
        MockStork newStork = new MockStork();
        vm.prank(admin);
        collateralManager.setStorkOracle(address(newStork));
        assertEq(collateralManager.storkOracle(), address(newStork), "Stork oracle should be updated");
    }

    // ========== Feed ID Tests ==========

    function test_ethusdFeedId_isCorrectConstant() public view {
        bytes32 expectedFeedId = 0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160;
        assertEq(collateralManager.ETHUSD_FEED_ID(), expectedFeedId, "ETHUSD feed ID should match");
    }

    function test_priceFeedId_initializedForBridgedETH() public view {
        bytes32 feedId = collateralManager.getPriceFeedId(address(bridgedETH));
        assertEq(feedId, ETHUSD_FEED_ID, "BridgedETH feed ID should be initialized");
    }

    function test_priceFeedId_canBeSetByAdmin() public {
        address newToken = makeAddr("newToken");
        bytes32 newFeedId = keccak256("BTCUSD");

        vm.prank(admin);
        collateralManager.setPriceFeedId(newToken, newFeedId);

        assertEq(collateralManager.getPriceFeedId(newToken), newFeedId, "New feed ID should be set");
    }

    function test_priceFeedId_revertsForNonAdmin() public {
        address newToken = makeAddr("newToken");
        bytes32 newFeedId = keccak256("BTCUSD");
        bytes32 adminRole = collateralManager.DEFAULT_ADMIN_ROLE();

        vm.expectRevert(abi.encodeWithSignature("AccessControlUnauthorizedAccount(address,bytes32)", alice, adminRole));
        vm.prank(alice);
        collateralManager.setPriceFeedId(newToken, newFeedId);
    }

    function test_priceFeedId_revertsForZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(ChariotBase.ZeroAddress.selector);
        collateralManager.setPriceFeedId(address(0), keccak256("FEED"));
    }

    function test_priceFeedId_revertsForZeroFeedId() public {
        vm.prank(admin);
        vm.expectRevert(ChariotBase.OracleFeedNotConfigured.selector);
        collateralManager.setPriceFeedId(makeAddr("token"), bytes32(0));
    }

    function test_priceFeedId_multipleFeedsCanBeConfigured() public {
        address tokenA = makeAddr("tokenA");
        address tokenB = makeAddr("tokenB");
        bytes32 feedA = keccak256("FEEDID_A");
        bytes32 feedB = keccak256("FEEDID_B");

        vm.startPrank(admin);
        collateralManager.setPriceFeedId(tokenA, feedA);
        collateralManager.setPriceFeedId(tokenB, feedB);
        vm.stopPrank();

        assertEq(collateralManager.getPriceFeedId(tokenA), feedA, "Feed A should be set");
        assertEq(collateralManager.getPriceFeedId(tokenB), feedB, "Feed B should be set");
        // Original BridgedETH feed should still be intact
        assertEq(collateralManager.getPriceFeedId(address(bridgedETH)), ETHUSD_FEED_ID, "BridgedETH feed intact");
    }

    function test_priceFeedId_emitsPriceFeedIdSetEvent() public {
        address newToken = makeAddr("newToken");
        bytes32 newFeedId = keccak256("BTCUSD");

        vm.expectEmit(true, false, false, true);
        emit CollateralManager.PriceFeedIdSet(newToken, newFeedId);

        vm.prank(admin);
        collateralManager.setPriceFeedId(newToken, newFeedId);
    }

    // ========== Oracle Price WAD Format Tests ==========

    function test_oraclePrice_convertsToWADFormat() public view {
        // ETH_PRICE is 2000e18 (already WAD)
        uint256 ethPrice = collateralManager.getETHPrice();
        assertEq(ethPrice, 2000e18, "ETH price should be in WAD format (18 decimals)");
    }

    function test_oraclePrice_collateralValueCalculation() public {
        // Setup: alice deposits 5 ETH collateral
        vm.prank(relayer);
        bridgedETH.mint(alice, 5 ether, 1);
        vm.startPrank(alice);
        bridgedETH.approve(address(collateralManager), 5 ether);
        collateralManager.depositCollateral(address(bridgedETH), 5 ether);
        vm.stopPrank();

        // 5 ETH * $2000 = $10,000 USDC (6 decimals)
        uint256 collateralValue = collateralManager.getCollateralValueView(alice);
        assertEq(collateralValue, 10_000 * USDC_UNIT, "5 ETH at $2000 = $10,000 USDC");
    }

    // ========== Zero Price Tests ==========

    function test_oraclePrice_zeroReturnsZeroCollateralValue() public {
        // Set zero price
        stork.setPriceNow(ETHUSD_FEED_ID, int192(0));

        // CollateralManager._getETHPrice returns 0 for zero price
        uint256 ethPrice = collateralManager.getETHPrice();
        assertEq(ethPrice, 0, "Zero oracle price should return 0");
    }

    // ========== ChariotBase _getValidatedPrice Tests ==========

    function test_getValidatedPrice_revertsOnStaleData() public {
        // Set stale price (3601 seconds ago)
        uint256 staleTimestamp = block.timestamp - 3601;
        stork.setPrice(ETHUSD_FEED_ID, ETH_PRICE, uint64(staleTimestamp) * 1e9);

        // Deploy a test harness to call internal _getValidatedPrice
        OracleTestHarness harness = new OracleTestHarness(address(stork), admin);

        vm.expectRevert(ChariotBase.OracleDataStale.selector);
        harness.getValidatedPriceExternal(ETHUSD_FEED_ID);
    }

    function test_getValidatedPrice_revertsOnZeroPrice() public {
        // Set zero price
        stork.setPriceNow(ETHUSD_FEED_ID, int192(0));

        OracleTestHarness harness = new OracleTestHarness(address(stork), admin);

        vm.expectRevert(ChariotBase.ZeroPriceReturned.selector);
        harness.getValidatedPriceExternal(ETHUSD_FEED_ID);
    }

    function test_getValidatedPrice_revertsOnUnconfiguredOracle() public {
        // Harness with no oracle
        OracleTestHarness harness = new OracleTestHarness(address(0), admin);

        vm.expectRevert(ChariotBase.OracleFeedNotConfigured.selector);
        harness.getValidatedPriceExternal(ETHUSD_FEED_ID);
    }

    function test_getValidatedPrice_revertsOnZeroFeedId() public {
        OracleTestHarness harness = new OracleTestHarness(address(stork), admin);

        vm.expectRevert(ChariotBase.OracleFeedNotConfigured.selector);
        harness.getValidatedPriceExternal(bytes32(0));
    }

    function test_getValidatedPrice_returnsCorrectPriceAndTimestamp() public {
        OracleTestHarness harness = new OracleTestHarness(address(stork), admin);

        (uint256 price, uint256 timestamp) = harness.getValidatedPriceExternal(ETHUSD_FEED_ID);
        assertEq(price, uint256(uint192(ETH_PRICE)), "Price should match");
        assertEq(timestamp, block.timestamp, "Timestamp should match block.timestamp");
    }

    // ========== STALENESS_THRESHOLD Constant Test ==========

    function test_stalenessThreshold_is3600() public view {
        assertEq(collateralManager.STALENESS_THRESHOLD(), 3600, "Staleness threshold should be 3600 seconds");
    }

    // ========== Integration: Oracle + Borrow ==========

    function test_integration_borrowUsesOraclePrice() public {
        // Deposit collateral for alice
        vm.prank(relayer);
        bridgedETH.mint(alice, 5 ether, 1);
        vm.startPrank(alice);
        bridgedETH.approve(address(collateralManager), 5 ether);
        collateralManager.depositCollateral(address(bridgedETH), 5 ether);

        // Borrow with empty price updates (uses stored price)
        pool.borrow(address(bridgedETH), 1000 * USDC_UNIT, emptyUpdates);

        uint256 debt = pool.getUserDebt(alice);
        assertEq(debt, 1000 * USDC_UNIT, "Alice should have $1000 debt");
        vm.stopPrank();
    }

    // ========== Integration: Oracle Price Update Affects Collateral Value ==========

    function test_integration_priceUpdateAffectsCollateralValue() public {
        // Deposit collateral for alice
        vm.prank(relayer);
        bridgedETH.mint(alice, 5 ether, 1);
        vm.startPrank(alice);
        bridgedETH.approve(address(collateralManager), 5 ether);
        collateralManager.depositCollateral(address(bridgedETH), 5 ether);
        vm.stopPrank();

        // Check value at $2000
        uint256 valueBefore = collateralManager.getCollateralValueView(alice);
        assertEq(valueBefore, 10_000 * USDC_UNIT, "5 ETH * $2000 = $10,000");

        // Update price to $3000
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(3000e18)));

        // Check value at $3000
        uint256 valueAfter = collateralManager.getCollateralValueView(alice);
        assertEq(valueAfter, 15_000 * USDC_UNIT, "5 ETH * $3000 = $15,000");
    }

    // ========== Fuzz Test ==========

    function testFuzz_oraclePrice_validRange(uint256 rawPrice) public {
        rawPrice = bound(rawPrice, 1e18, 100_000e18); // $1 to $100,000

        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(rawPrice)));

        uint256 ethPrice = collateralManager.getETHPrice();
        assertEq(ethPrice, rawPrice, "Price should match set value");
    }
}

/// @dev Test harness to expose ChariotBase internal oracle functions
contract OracleTestHarness is ChariotBase {
    constructor(address storkOracle_, address admin_) {
        storkOracle = storkOracle_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
    }

    function getValidatedPriceExternal(bytes32 feedId) external view returns (uint256 price, uint256 timestamp) {
        return _getValidatedPrice(feedId);
    }
}
