// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {CollateralManager} from "../src/core/CollateralManager.sol";
import {ChariotBase} from "../src/base/ChariotBase.sol";
import {ICollateralManager} from "../src/interfaces/ICollateralManager.sol";
import {ILendingPool} from "../src/interfaces/ILendingPool.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockStork} from "./mocks/MockStork.sol";
import {StorkStructs} from "@stork-oracle/StorkStructs.sol";

/// @dev Mock LendingPool that returns configurable debt
contract MockLendingPool {
    mapping(address => uint256) private _debts;

    function setUserDebt(address user, uint256 debt) external {
        _debts[user] = debt;
    }

    function getUserDebt(address user) external view returns (uint256) {
        return _debts[user];
    }
}

contract CollateralManagerTest is Test {
    CollateralManager public manager;
    MockERC20 public bridgedETH;
    MockStork public stork;
    MockLendingPool public lendingPool;

    address public admin = makeAddr("admin");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 constant ONE_ETH = 1 ether;
    // ETH price: $2000 in 18 decimal WAD
    int192 constant ETH_PRICE = 2000e18;
    bytes32 constant ETHUSD_FEED_ID = 0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160;

    StorkStructs.TemporalNumericValueInput[] emptyUpdates;

    function setUp() public {
        bridgedETH = new MockERC20("Bridged ETH", "bETH", 18);
        stork = new MockStork();
        lendingPool = new MockLendingPool();

        manager = new CollateralManager(address(bridgedETH), address(stork), admin);

        // Wire up lending pool
        vm.prank(admin);
        manager.setLendingPool(address(lendingPool));

        // Set ETH price to $2000
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);

        // Fund test accounts
        bridgedETH.mint(alice, 100 ether);
        bridgedETH.mint(bob, 50 ether);

        // Approve collateral manager
        vm.prank(alice);
        bridgedETH.approve(address(manager), type(uint256).max);
        vm.prank(bob);
        bridgedETH.approve(address(manager), type(uint256).max);
    }

    // ================================================================
    // Deposit Tests
    // ================================================================

    function test_depositCollateral_succeeds() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit ICollateralManager.CollateralDeposited(alice, address(bridgedETH), 5 ether);
        manager.depositCollateral(address(bridgedETH), 5 ether);

        assertEq(manager.getCollateralBalance(alice, address(bridgedETH)), 5 ether);
        assertEq(bridgedETH.balanceOf(address(manager)), 5 ether);
    }

    function test_depositCollateral_zeroAmountReverts() public {
        vm.prank(alice);
        vm.expectRevert(ChariotBase.ZeroAmount.selector);
        manager.depositCollateral(address(bridgedETH), 0);
    }

    function test_depositCollateral_invalidTokenReverts() public {
        vm.prank(alice);
        vm.expectRevert(ICollateralManager.InvalidToken.selector);
        manager.depositCollateral(address(0x1234), ONE_ETH);
    }

    function test_depositCollateral_multipleDeposits() public {
        vm.startPrank(alice);
        manager.depositCollateral(address(bridgedETH), 3 ether);
        manager.depositCollateral(address(bridgedETH), 2 ether);
        vm.stopPrank();

        assertEq(manager.getCollateralBalance(alice, address(bridgedETH)), 5 ether);
    }

    // ================================================================
    // Withdraw Tests
    // ================================================================

    function test_withdrawCollateral_succeedsWhenNoDebt() public {
        vm.prank(alice);
        manager.depositCollateral(address(bridgedETH), 5 ether);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit ICollateralManager.CollateralWithdrawn(alice, address(bridgedETH), 5 ether);
        manager.withdrawCollateral(address(bridgedETH), 5 ether);

        assertEq(manager.getCollateralBalance(alice, address(bridgedETH)), 0);
        assertEq(bridgedETH.balanceOf(alice), 100 ether);
    }

    function test_withdrawCollateral_revertsWithDebt() public {
        vm.prank(alice);
        manager.depositCollateral(address(bridgedETH), 5 ether);

        // Set debt
        lendingPool.setUserDebt(alice, 1000e6); // $1000 USDC debt

        vm.prank(alice);
        vm.expectRevert(ICollateralManager.DebtOutstanding.selector);
        manager.withdrawCollateral(address(bridgedETH), 5 ether);
    }

    function test_withdrawCollateral_revertsExceedingBalance() public {
        vm.prank(alice);
        manager.depositCollateral(address(bridgedETH), 5 ether);

        vm.prank(alice);
        vm.expectRevert(ICollateralManager.InsufficientCollateral.selector);
        manager.withdrawCollateral(address(bridgedETH), 6 ether);
    }

    function test_withdrawCollateral_revertsInvalidToken() public {
        vm.prank(alice);
        vm.expectRevert(ICollateralManager.InvalidToken.selector);
        manager.withdrawCollateral(address(0x1234), ONE_ETH);
    }

    // ================================================================
    // Collateral Value Tests
    // ================================================================

    function test_getCollateralValue_withKnownPrice() public {
        vm.prank(alice);
        manager.depositCollateral(address(bridgedETH), ONE_ETH);

        // 1 ETH at $2000 = 2000 USDC (2000e6)
        uint256 value = manager.getCollateralValue(alice, emptyUpdates);
        assertEq(value, 2000e6);
    }

    function test_getCollateralValue_multipleETH() public {
        vm.prank(alice);
        manager.depositCollateral(address(bridgedETH), 5 ether);

        // 5 ETH at $2000 = 10000 USDC
        uint256 value = manager.getCollateralValue(alice, emptyUpdates);
        assertEq(value, 10_000e6);
    }

    function test_getCollateralValue_zeroCollateral() public {
        uint256 value = manager.getCollateralValue(alice, emptyUpdates);
        assertEq(value, 0);
    }

    // ================================================================
    // Health Factor Tests
    // ================================================================

    function test_getHealthFactor_noDebtReturnsMax() public {
        vm.prank(alice);
        manager.depositCollateral(address(bridgedETH), ONE_ETH);

        uint256 hf = manager.getHealthFactor(alice, emptyUpdates);
        assertEq(hf, type(uint256).max);
    }

    function test_getHealthFactor_calculation() public {
        vm.prank(alice);
        manager.depositCollateral(address(bridgedETH), ONE_ETH);

        // Set debt to $1000 USDC
        lendingPool.setUserDebt(alice, 1000e6);

        // HF = (collateral_value * 0.82) / debt
        // = (2000 * 0.82) / 1000 = 1640 / 1000 = 1.64e18
        uint256 hf = manager.getHealthFactor(alice, emptyUpdates);
        assertEq(hf, 1.64e18);
    }

    function test_getHealthFactor_belowOne() public {
        vm.prank(alice);
        manager.depositCollateral(address(bridgedETH), ONE_ETH);

        // Set debt to $2000 USDC -- at liquidation threshold
        lendingPool.setUserDebt(alice, 2000e6);

        // HF = (2000 * 0.82) / 2000 = 0.82e18
        uint256 hf = manager.getHealthFactor(alice, emptyUpdates);
        assertEq(hf, 0.82e18);
    }

    // ================================================================
    // LTV Tests
    // ================================================================

    function test_effectiveLTV_isCorrect() public view {
        assertEq(manager.getEffectiveLTV(), 0.75e18);
    }

    function test_liquidationThreshold_isCorrect() public view {
        assertEq(manager.getLiquidationThreshold(), 0.82e18);
    }

    function test_constants_areCorrect() public view {
        assertEq(manager.BASE_LTV(), 0.75e18);
        assertEq(manager.MIN_LTV(), 0.3e18);
        assertEq(manager.LIQUIDATION_BUFFER(), 0.07e18);
        assertEq(manager.LIQUIDATION_THRESHOLD(), 0.82e18);
    }

    // ================================================================
    // Admin Tests
    // ================================================================

    function test_setLendingPool_succeeds() public {
        address newPool = makeAddr("newPool");
        vm.prank(admin);
        manager.setLendingPool(newPool);
    }

    function test_getBridgedETH_returnsCorrect() public view {
        assertEq(manager.getBridgedETH(), address(bridgedETH));
    }
}
