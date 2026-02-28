// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {LendingPool} from "../src/core/LendingPool.sol";
import {CollateralManager} from "../src/core/CollateralManager.sol";
import {ChariotVault} from "../src/core/ChariotVault.sol";
import {CCTPBridge} from "../src/bridge/CCTPBridge.sol";
import {InterestRateModel} from "../src/risk/InterestRateModel.sol";
import {ILendingPool} from "../src/interfaces/ILendingPool.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockStork} from "./mocks/MockStork.sol";
import {MockUSYCTeller} from "./mocks/MockUSYCTeller.sol";
import {MockTokenMessengerV2} from "./mocks/MockTokenMessengerV2.sol";
import {BridgedETH} from "../src/bridge/BridgedETH.sol";
import {StorkStructs} from "@stork-oracle/StorkStructs.sol";

contract BorrowAndBridgeTest is Test {
    LendingPool public pool;
    CollateralManager public collateralManager;
    ChariotVault public vault;
    InterestRateModel public rateModel;
    CCTPBridge public bridge;
    MockERC20 public usdc;
    MockERC20 public usyc;
    MockStork public stork;
    MockUSYCTeller public teller;
    MockTokenMessengerV2 public messenger;
    BridgedETH public bridgedETH;

    address public admin = makeAddr("admin");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public relayer = makeAddr("relayer");

    uint256 constant USDC_UNIT = 1e6;
    int192 constant ETH_PRICE = 2000e18; // $2000
    bytes32 constant ETHUSD_FEED_ID = 0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160;
    uint32 constant DOMAIN_ETHEREUM = 0;
    uint32 constant DOMAIN_ARBITRUM = 3;

    StorkStructs.TemporalNumericValueInput[] emptyUpdates;

    function setUp() public {
        // Deploy tokens and mocks
        usdc = new MockERC20("USD Coin", "USDC", 6);
        usyc = new MockERC20("US Yield Coin", "USYC", 6);
        stork = new MockStork();
        teller = new MockUSYCTeller(address(usdc), address(usyc), 1e18);
        bridgedETH = new BridgedETH(admin, relayer);
        messenger = new MockTokenMessengerV2(address(usdc));

        // Deploy core contracts
        rateModel = new InterestRateModel();
        vault = new ChariotVault(address(usdc), address(usyc), address(teller), address(stork), admin);
        collateralManager = new CollateralManager(address(bridgedETH), address(stork), admin);
        pool = new LendingPool(address(usdc), address(stork), admin);
        bridge = new CCTPBridge(address(messenger), address(usdc), admin);

        // Wire dependencies
        vm.startPrank(admin);
        pool.setInterestRateModel(address(rateModel));
        pool.setCollateralManager(address(collateralManager));
        pool.setVault(address(vault));
        pool.setCCTPBridge(address(bridge));
        collateralManager.setLendingPool(address(pool));
        vault.grantRole(vault.LENDING_POOL_ROLE(), address(pool));
        vm.stopPrank();

        // Set ETH price
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);

        // Fund vault with USDC (depositors)
        usdc.mint(address(this), 1_000_000 * USDC_UNIT);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(1_000_000 * USDC_UNIT, address(this));

        // Give alice 5 ETH collateral ($10,000) and deposit
        vm.prank(relayer);
        bridgedETH.mint(alice, 5 ether, 0);
        vm.startPrank(alice);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 5 ether);
        vm.stopPrank();
    }

    // ================================================================
    // borrowAndBridge Tests
    // ================================================================

    function test_borrowAndBridge_succeedsWithValidParams() public {
        bytes32 recipient = bytes32(uint256(uint160(bob)));
        uint256 amount = 3000 * USDC_UNIT; // $3000 borrow against $10k collateral (30% LTV)

        vm.prank(alice);
        pool.borrowAndBridge(address(bridgedETH), amount, DOMAIN_ETHEREUM, recipient, emptyUpdates);

        // Verify debt recorded
        assertEq(pool.getUserDebt(alice), amount);
        assertEq(pool.getTotalBorrowed(), amount);

        // Verify USDC was bridged (transferred to messenger mock)
        assertEq(messenger.lastAmount(), amount);
        assertEq(messenger.lastDestinationDomain(), DOMAIN_ETHEREUM);
        assertEq(messenger.lastMintRecipient(), recipient);
    }

    function test_borrowAndBridge_emitsBorrowedAndBridgedEvent() public {
        bytes32 recipient = bytes32(uint256(uint160(bob)));
        uint256 amount = 2000 * USDC_UNIT;

        vm.expectEmit(true, true, false, false);
        emit ILendingPool.BorrowedAndBridged(alice, address(bridgedETH), amount, DOMAIN_ETHEREUM, recipient, 0);

        vm.prank(alice);
        pool.borrowAndBridge(address(bridgedETH), amount, DOMAIN_ETHEREUM, recipient, emptyUpdates);
    }

    function test_borrowAndBridge_revertsCCTPBridgeNotSet() public {
        // Deploy a fresh pool without CCTPBridge set
        LendingPool freshPool = new LendingPool(address(usdc), address(stork), admin);
        vm.startPrank(admin);
        freshPool.setInterestRateModel(address(rateModel));
        freshPool.setCollateralManager(address(collateralManager));
        freshPool.setVault(address(vault));
        vm.stopPrank();

        bytes32 recipient = bytes32(uint256(uint160(bob)));

        vm.prank(alice);
        vm.expectRevert(ILendingPool.CCTPBridgeNotSet.selector);
        freshPool.borrowAndBridge(address(bridgedETH), 1000 * USDC_UNIT, DOMAIN_ETHEREUM, recipient, emptyUpdates);
    }

    function test_borrowAndBridge_revertsExceedsLTV() public {
        bytes32 recipient = bytes32(uint256(uint160(bob)));
        // 5 ETH at $2000 = $10,000 collateral. 75% LTV = max $7,500 borrow
        uint256 amount = 8000 * USDC_UNIT; // Exceeds LTV

        vm.prank(alice);
        vm.expectRevert(ILendingPool.ExceedsLTV.selector);
        pool.borrowAndBridge(address(bridgedETH), amount, DOMAIN_ETHEREUM, recipient, emptyUpdates);
    }

    function test_borrowAndBridge_revertsZeroAmount() public {
        bytes32 recipient = bytes32(uint256(uint160(bob)));

        vm.prank(alice);
        vm.expectRevert();
        pool.borrowAndBridge(address(bridgedETH), 0, DOMAIN_ETHEREUM, recipient, emptyUpdates);
    }

    function test_borrowAndBridge_recordsDebtSameAsBorrow() public {
        bytes32 recipient = bytes32(uint256(uint160(bob)));
        uint256 amount = 2000 * USDC_UNIT;

        vm.prank(alice);
        pool.borrowAndBridge(address(bridgedETH), amount, DOMAIN_ETHEREUM, recipient, emptyUpdates);

        // Verify position
        ILendingPool.BorrowerPosition memory pos = pool.getUserPosition(alice);
        assertEq(pos.principal, amount);
        assertTrue(pos.interestIndex > 0);
    }

    function test_borrowAndBridge_worksToMultipleChains() public {
        bytes32 recipient = bytes32(uint256(uint160(bob)));

        vm.prank(alice);
        pool.borrowAndBridge(address(bridgedETH), 1000 * USDC_UNIT, DOMAIN_ETHEREUM, recipient, emptyUpdates);

        assertEq(messenger.callCount(), 1);
        assertEq(pool.getUserDebt(alice), 1000 * USDC_UNIT);

        vm.prank(alice);
        pool.borrowAndBridge(address(bridgedETH), 1000 * USDC_UNIT, DOMAIN_ARBITRUM, recipient, emptyUpdates);

        assertEq(messenger.callCount(), 2);
        assertEq(pool.getUserDebt(alice), 2000 * USDC_UNIT);
    }

    function test_setCCTPBridge_canDisableBySettingZero() public {
        vm.prank(admin);
        pool.setCCTPBridge(address(0));

        bytes32 recipient = bytes32(uint256(uint160(bob)));
        vm.prank(alice);
        vm.expectRevert(ILendingPool.CCTPBridgeNotSet.selector);
        pool.borrowAndBridge(address(bridgedETH), 1000 * USDC_UNIT, DOMAIN_ETHEREUM, recipient, emptyUpdates);
    }
}
