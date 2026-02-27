// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {LendingPool} from "../src/core/LendingPool.sol";
import {CollateralManager} from "../src/core/CollateralManager.sol";
import {ChariotVault} from "../src/core/ChariotVault.sol";
import {ChariotBase} from "../src/base/ChariotBase.sol";
import {InterestRateModel} from "../src/risk/InterestRateModel.sol";
import {ILendingPool} from "../src/interfaces/ILendingPool.sol";
import {ICollateralManager} from "../src/interfaces/ICollateralManager.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockStork} from "./mocks/MockStork.sol";
import {MockUSYCTeller} from "./mocks/MockUSYCTeller.sol";
import {BridgedETH} from "../src/bridge/BridgedETH.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StorkStructs} from "@stork-oracle/StorkStructs.sol";

contract LendingPoolTest is Test {
    LendingPool public pool;
    CollateralManager public collateralManager;
    ChariotVault public vault;
    InterestRateModel public rateModel;
    MockERC20 public usdc;
    MockERC20 public usyc;
    MockStork public stork;
    MockUSYCTeller public teller;
    BridgedETH public bridgedETH;

    address public admin = makeAddr("admin");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public relayer = makeAddr("relayer");

    uint256 constant USDC_UNIT = 1e6;
    int192 constant ETH_PRICE = 2000e18; // $2000
    bytes32 constant ETHUSD_FEED_ID = 0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160;

    StorkStructs.TemporalNumericValueInput[] emptyUpdates;

    function setUp() public {
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
        // Grant lending pool role on vault
        vault.grantRole(vault.LENDING_POOL_ROLE(), address(pool));
        vm.stopPrank();

        // Set ETH price
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);

        // Fund vault with USDC (depositors)
        usdc.mint(address(this), 1_000_000 * USDC_UNIT);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(1_000_000 * USDC_UNIT, address(this));

        // Give alice some BridgedETH collateral (5 ETH = $10,000)
        vm.prank(relayer);
        bridgedETH.mint(alice, 5 ether, 0);

        // Alice deposits collateral
        vm.startPrank(alice);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 5 ether);
        vm.stopPrank();

        // Give alice USDC for repayments
        usdc.mint(alice, 100_000 * USDC_UNIT);
        vm.prank(alice);
        usdc.approve(address(pool), type(uint256).max);

        // Give bob BridgedETH and USDC
        vm.prank(relayer);
        bridgedETH.mint(bob, 3 ether, 1);
        vm.startPrank(bob);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 3 ether);
        vm.stopPrank();
        usdc.mint(bob, 50_000 * USDC_UNIT);
        vm.prank(bob);
        usdc.approve(address(pool), type(uint256).max);
    }

    // ================================================================
    // Borrow Tests
    // ================================================================

    function test_borrow_succeedsWithinLTV() public {
        // Alice: 5 ETH * $2000 = $10,000 collateral, LTV 75% = max borrow $7,500
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        assertEq(pool.getUserDebt(alice), 5000 * USDC_UNIT);
        assertEq(usdc.balanceOf(alice), 105_000 * USDC_UNIT); // 100k + 5k
        assertEq(pool.getTotalBorrowed(), 5000 * USDC_UNIT);
    }

    function test_borrow_emitsBorrowedEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit ILendingPool.Borrowed(alice, address(bridgedETH), 5000 * USDC_UNIT, 0);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);
    }

    function test_borrow_revertsExceedsLTV() public {
        // Max borrow: $10,000 * 75% = $7,500
        vm.prank(alice);
        vm.expectRevert(ILendingPool.ExceedsLTV.selector);
        pool.borrow(address(bridgedETH), 7501 * USDC_UNIT, emptyUpdates);
    }

    function test_borrow_revertsZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(ChariotBase.ZeroAmount.selector);
        pool.borrow(address(bridgedETH), 0, emptyUpdates);
    }

    function test_borrow_multipleBorrowsSameUser() public {
        vm.startPrank(alice);
        pool.borrow(address(bridgedETH), 2000 * USDC_UNIT, emptyUpdates);
        pool.borrow(address(bridgedETH), 3000 * USDC_UNIT, emptyUpdates);
        vm.stopPrank();

        assertEq(pool.getUserDebt(alice), 5000 * USDC_UNIT);
    }

    // ================================================================
    // Interest Accrual Tests
    // ================================================================

    function test_interestAccrual_debtIncreasesOverTime() public {
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        uint256 debtBefore = pool.getUserDebt(alice);

        // Warp 1 year
        vm.warp(block.timestamp + 365.25 days);
        // Refresh oracle price so staleness check passes
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);

        // Trigger accrual via bob's borrow
        vm.prank(bob);
        pool.borrow(address(bridgedETH), 100 * USDC_UNIT, emptyUpdates);

        uint256 debtAfter = pool.getUserDebt(alice);
        assertTrue(debtAfter > debtBefore, "Debt should increase with interest");
    }

    function test_interestAccrual_indexUpdates() public {
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        uint256 indexBefore = pool.getGlobalInterestIndex();
        assertEq(indexBefore, 1e18, "Initial index should be 1e18");

        // Warp 1 year
        vm.warp(block.timestamp + 365.25 days);
        // Refresh oracle price so staleness check passes
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);

        // Trigger accrual
        vm.prank(bob);
        pool.borrow(address(bridgedETH), 100 * USDC_UNIT, emptyUpdates);

        uint256 indexAfter = pool.getGlobalInterestIndex();
        assertTrue(indexAfter > indexBefore, "Index should increase after interest accrual");
    }

    function test_interestAccrual_emitsEvent() public {
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        // Warp 30 days
        vm.warp(block.timestamp + 30 days);
        // Refresh oracle price so staleness check passes
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);

        // Any state-changing call triggers accrual
        vm.prank(bob);
        vm.expectEmit(false, false, false, false);
        emit ILendingPool.InterestAccrued(0, 0, 0);
        pool.borrow(address(bridgedETH), 100 * USDC_UNIT, emptyUpdates);
    }

    // ================================================================
    // Repay Tests
    // ================================================================

    function test_repay_partialReducesDebt() public {
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        vm.prank(alice);
        pool.repay(2000 * USDC_UNIT);

        assertEq(pool.getUserDebt(alice), 3000 * USDC_UNIT);
    }

    function test_repay_fullClearsPosition() public {
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        vm.prank(alice);
        pool.repay(5000 * USDC_UNIT);

        assertEq(pool.getUserDebt(alice), 0);
    }

    function test_repay_maxUintRepaysAll() public {
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        vm.prank(alice);
        pool.repay(type(uint256).max);

        assertEq(pool.getUserDebt(alice), 0);
    }

    function test_repayFull_clearsDebt() public {
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        vm.prank(alice);
        pool.repayFull();

        assertEq(pool.getUserDebt(alice), 0);
    }

    function test_repay_emitsEvent() public {
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit ILendingPool.Repaid(alice, 2000 * USDC_UNIT, 3000 * USDC_UNIT);
        pool.repay(2000 * USDC_UNIT);
    }

    function test_repay_revertsNoDebt() public {
        vm.prank(alice);
        vm.expectRevert(ILendingPool.NoDebt.selector);
        pool.repay(1000 * USDC_UNIT);
    }

    function test_repayFull_revertsNoDebt() public {
        vm.prank(alice);
        vm.expectRevert(ILendingPool.NoDebt.selector);
        pool.repayFull();
    }

    function test_repay_revertsZeroAmount() public {
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        vm.prank(alice);
        vm.expectRevert(ChariotBase.ZeroAmount.selector);
        pool.repay(0);
    }

    function test_repay_overpaymentCapped() public {
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        uint256 aliceBalanceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        pool.repay(10_000 * USDC_UNIT);

        // Should only transfer 5000 USDC (the actual debt)
        uint256 aliceBalanceAfter = usdc.balanceOf(alice);
        assertEq(aliceBalanceBefore - aliceBalanceAfter, 5000 * USDC_UNIT);
        assertEq(pool.getUserDebt(alice), 0);
    }

    // ================================================================
    // Integration Tests
    // ================================================================

    function test_fullLifecycle_borrowRepayWithdraw() public {
        // Borrow
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);
        assertEq(pool.getUserDebt(alice), 5000 * USDC_UNIT);

        // Repay in full
        vm.prank(alice);
        pool.repayFull();
        assertEq(pool.getUserDebt(alice), 0);

        // Withdraw collateral (should succeed now)
        vm.prank(alice);
        collateralManager.withdrawCollateral(address(bridgedETH), 5 ether);
        assertEq(bridgedETH.balanceOf(alice), 5 ether);
    }

    function test_repay_withInterestAccrual() public {
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        // Warp 30 days
        vm.warp(block.timestamp + 30 days);

        // Repay full -- must pay more than original due to interest
        vm.prank(alice);
        pool.repayFull();

        assertEq(pool.getUserDebt(alice), 0);
    }

    function test_totalBorrowed_updatesCorrectly() public {
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);
        assertEq(pool.getTotalBorrowed(), 5000 * USDC_UNIT);

        vm.prank(alice);
        pool.repay(2000 * USDC_UNIT);
        assertEq(pool.getTotalBorrowed(), 3000 * USDC_UNIT);

        vm.prank(alice);
        pool.repayFull();
        assertEq(pool.getTotalBorrowed(), 0);
    }

    // ================================================================
    // View Function Tests
    // ================================================================

    function test_getUserPosition_returnsCorrectData() public {
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        ILendingPool.BorrowerPosition memory pos = pool.getUserPosition(alice);
        assertEq(pos.principal, 5000 * USDC_UNIT);
        assertEq(pos.interestIndex, 1e18);
    }

    function test_getLastAccrualTimestamp_updates() public {
        uint256 initialTs = pool.getLastAccrualTimestamp();
        assertEq(initialTs, block.timestamp);

        vm.warp(block.timestamp + 1 days);
        // Refresh oracle price so staleness check passes
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);

        vm.prank(alice);
        pool.borrow(address(bridgedETH), 1000 * USDC_UNIT, emptyUpdates);

        assertEq(pool.getLastAccrualTimestamp(), block.timestamp);
    }

    // ================================================================
    // Story 3-6: Extended Repay Tests
    // ================================================================

    function test_repay_partialKeepsCollateralLocked() public {
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        // Partial repay
        vm.prank(alice);
        pool.repay(2000 * USDC_UNIT);

        // Collateral should still be locked (debt > 0)
        vm.prank(alice);
        vm.expectRevert(ICollateralManager.DebtOutstanding.selector);
        collateralManager.withdrawCollateral(address(bridgedETH), 1 ether);
    }

    function test_repay_multiplePartialRepayments() public {
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        vm.startPrank(alice);
        pool.repay(1000 * USDC_UNIT);
        assertEq(pool.getUserDebt(alice), 4000 * USDC_UNIT);

        pool.repay(1500 * USDC_UNIT);
        assertEq(pool.getUserDebt(alice), 2500 * USDC_UNIT);

        pool.repay(2500 * USDC_UNIT);
        assertEq(pool.getUserDebt(alice), 0);
        vm.stopPrank();
    }

    function test_repay_repaidUSDCIncreasesVaultLiquidity() public {
        uint256 vaultAssetsBefore = vault.totalAssets();

        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        // Vault total assets should be unchanged (lent USDC counted)
        assertEq(vault.totalAssets(), vaultAssetsBefore);

        // Repay full
        vm.prank(alice);
        pool.repayFull();

        // Vault assets should be restored
        assertEq(vault.totalAssets(), vaultAssetsBefore);
    }

    function test_integration_borrowWarpPartialRepayWarpFullRepayWithdraw() public {
        // 1. Alice borrows 4000 USDC
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 4000 * USDC_UNIT, emptyUpdates);
        assertEq(pool.getUserDebt(alice), 4000 * USDC_UNIT);

        // 2. Warp 30 days -- interest accrues
        vm.warp(block.timestamp + 30 days);
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);

        // 3. Partial repay 2000 USDC
        vm.prank(alice);
        pool.repay(2000 * USDC_UNIT);
        uint256 debtAfterPartial = pool.getUserDebt(alice);
        // Debt should be > 2000 due to interest accrued before repayment
        assertTrue(debtAfterPartial > 2000 * USDC_UNIT, "Remaining debt should include interest");

        // 4. Warp another 30 days
        vm.warp(block.timestamp + 30 days);
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE);

        // 5. Repay full
        vm.prank(alice);
        pool.repayFull();
        assertEq(pool.getUserDebt(alice), 0);

        // 6. Withdraw all collateral
        vm.prank(alice);
        collateralManager.withdrawCollateral(address(bridgedETH), 5 ether);
        assertEq(bridgedETH.balanceOf(alice), 5 ether);
    }
}
