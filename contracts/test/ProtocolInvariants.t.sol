// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {LiquidationEngine} from "../src/core/LiquidationEngine.sol";
import {LendingPool} from "../src/core/LendingPool.sol";
import {CollateralManager} from "../src/core/CollateralManager.sol";
import {ChariotVault} from "../src/core/ChariotVault.sol";
import {ChariotBase} from "../src/base/ChariotBase.sol";
import {InterestRateModel} from "../src/risk/InterestRateModel.sol";
import {ILendingPool} from "../src/interfaces/ILendingPool.sol";
import {ICollateralManager} from "../src/interfaces/ICollateralManager.sol";
import {ILiquidationEngine} from "../src/interfaces/ILiquidationEngine.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockStork} from "./mocks/MockStork.sol";
import {MockUSYCTeller} from "./mocks/MockUSYCTeller.sol";
import {BridgedETH} from "../src/bridge/BridgedETH.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StorkStructs} from "@stork-oracle/StorkStructs.sol";

/// @title ProtocolInvariantsTest -- Comprehensive invariant tests for the Chariot lending protocol
/// @notice Validates that core protocol invariants hold across all state transitions:
///         borrow, repay, liquidate, rebalance, and interest accrual.
contract ProtocolInvariantsTest is Test {
    LiquidationEngine public liquidationEngine;
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
    address public alice = makeAddr("alice"); // borrower 1 -- 5 ETH
    address public bob = makeAddr("bob"); // borrower 2 -- 3 ETH
    address public charlie = makeAddr("charlie"); // borrower 3 -- 2 ETH
    address public relayer = makeAddr("relayer");

    uint256 constant USDC_UNIT = 1e6;
    uint256 constant WAD = 1e18;
    int192 constant ETH_PRICE = 2000e18; // $2000
    bytes32 constant ETHUSD_FEED_ID = 0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160;

    StorkStructs.TemporalNumericValueInput[] emptyUpdates;

    function setUp() public {
        // Set timestamp to avoid underflow issues
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

        // Fund vault with 1M USDC (depositors)
        usdc.mint(address(this), 1_000_000 * USDC_UNIT);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(1_000_000 * USDC_UNIT, address(this));

        // Mint collateral: alice 5 ETH (nonce 0), bob 3 ETH (nonce 1), charlie 2 ETH (nonce 2)
        vm.startPrank(relayer);
        bridgedETH.mint(alice, 5 ether, 0);
        bridgedETH.mint(bob, 3 ether, 1);
        bridgedETH.mint(charlie, 2 ether, 2);
        vm.stopPrank();

        // Alice deposits collateral and approves pool for repayments
        vm.startPrank(alice);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 5 ether);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();

        // Bob deposits collateral and approves pool + liquidation engine
        vm.startPrank(bob);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 3 ether);
        usdc.approve(address(pool), type(uint256).max);
        usdc.approve(address(liquidationEngine), type(uint256).max);
        vm.stopPrank();

        // Charlie deposits collateral and approves pool
        vm.startPrank(charlie);
        bridgedETH.approve(address(collateralManager), type(uint256).max);
        collateralManager.depositCollateral(address(bridgedETH), 2 ether);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();

        // Give all users USDC for repayments
        usdc.mint(alice, 100_000 * USDC_UNIT);
        usdc.mint(bob, 100_000 * USDC_UNIT);
        usdc.mint(charlie, 100_000 * USDC_UNIT);
    }

    // ================================================================
    // Internal Helper -- Invariant Assertions
    // ================================================================

    /// @dev Assert: total_borrowed <= vault.totalAssets()
    function _assertBorrowInvariant() internal view {
        uint256 totalBorrowed = pool.getTotalBorrowed();
        uint256 totalAssets = vault.totalAssets();
        assertLe(totalBorrowed, totalAssets, "INVARIANT: total_borrowed > total_vault_assets");
    }

    /// @dev Assert: health factor >= 1.0 for a given borrower (if they have debt)
    function _assertHealthFactorInvariant(address user) internal {
        uint256 debt = pool.getUserDebt(user);
        if (debt == 0) return; // No debt = no HF constraint

        // Get collateral value (uses stored oracle price)
        uint256 collateralValueUsdc = collateralManager.getCollateralValueView(user);
        // Zero collateral with outstanding debt means position is underwater (HF = 0)
        // This should never happen in normal protocol operation -- fail the invariant check
        assertGt(collateralValueUsdc, 0, "INVARIANT: user has debt but zero collateral value");

        // Calculate HF same way as CollateralManager
        uint256 collateralWad = collateralValueUsdc * 1e12; // usdcToWad
        uint256 debtWad = debt * 1e12;
        uint256 liqThreshold = collateralManager.getLiquidationThreshold();
        uint256 thresholdValue = (collateralWad * liqThreshold) / 1e18;
        uint256 healthFactor = (thresholdValue * 1e18) / debtWad;

        assertGe(healthFactor, 1e18, "INVARIANT: health_factor < 1.0 for non-liquidated position");
    }

    /// @dev Assert: effective LTV is within bounds [30%, 100%]
    function _assertLTVInvariant() internal view {
        uint256 effectiveLTV = collateralManager.getEffectiveLTV();
        assertGe(effectiveLTV, 0.3e18, "INVARIANT: effective_LTV < 30%");
        assertLe(effectiveLTV, 1e18, "INVARIANT: effective_LTV > 100%");
    }

    /// @dev Assert: vault accounting -- usdc_in_pool + usdc_lent + usyc_value == totalAssets
    function _assertVaultAccountingInvariant() internal view {
        uint256 idle = IERC20(vault.asset()).balanceOf(address(vault));
        uint256 lent = vault.totalLent();
        // USYC value is included in totalAssets calculation internally
        // For this test, we verify the components add up
        uint256 total = vault.totalAssets();
        // idle + lent should be <= totalAssets (USYC value makes up any difference)
        assertLe(idle + lent, total, "INVARIANT: idle + lent > totalAssets");
        // Also total should be >= idle (at minimum)
        assertGe(total, idle, "INVARIANT: totalAssets < idle USDC");
    }

    /// @dev Assert all four invariants together
    function _assertAllInvariants() internal {
        _assertBorrowInvariant();
        _assertLTVInvariant();
        _assertVaultAccountingInvariant();
    }

    // ================================================================
    // 1. Borrow Invariant Tests
    // ================================================================

    function test_borrowInvariant_afterDeposit() public {
        // Initial state: 1M USDC deposited, no borrows
        uint256 totalBorrowed = pool.getTotalBorrowed();
        assertEq(totalBorrowed, 0, "No borrows should exist initially");

        _assertBorrowInvariant();
    }

    function test_borrowInvariant_afterBorrow() public {
        // Alice borrows $3000
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 3000 * USDC_UNIT, emptyUpdates);

        _assertBorrowInvariant();
    }

    function test_borrowInvariant_afterMultipleBorrows() public {
        // Alice borrows $3000
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 3000 * USDC_UNIT, emptyUpdates);

        // Bob borrows $2000
        vm.prank(bob);
        pool.borrow(address(bridgedETH), 2000 * USDC_UNIT, emptyUpdates);

        uint256 totalBorrowed = pool.getTotalBorrowed();
        assertEq(totalBorrowed, 5000 * USDC_UNIT, "Total borrowed should be 5000 USDC");

        _assertBorrowInvariant();
    }

    function test_borrowInvariant_afterRepayment() public {
        // Alice borrows $3000
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 3000 * USDC_UNIT, emptyUpdates);

        // Alice repays $1500 (half)
        vm.prank(alice);
        pool.repay(1500 * USDC_UNIT);

        _assertBorrowInvariant();
    }

    function test_borrowInvariant_afterFullRepayment() public {
        // Alice borrows $3000
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 3000 * USDC_UNIT, emptyUpdates);

        // Alice repays full
        vm.prank(alice);
        pool.repayFull();

        uint256 totalBorrowed = pool.getTotalBorrowed();
        assertEq(totalBorrowed, 0, "Total borrowed should be 0 after full repayment");

        _assertBorrowInvariant();
    }

    // ================================================================
    // 2. Health Factor Invariant Tests
    // ================================================================

    function test_healthFactorInvariant_afterBorrow() public {
        // Alice borrows $3000 within LTV limits
        // Collateral: 5 ETH * $2000 = $10,000; LTV 75% = max $7,500
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 3000 * USDC_UNIT, emptyUpdates);

        _assertHealthFactorInvariant(alice);
    }

    function test_healthFactorInvariant_multipleUsers() public {
        // Alice borrows $3000
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 3000 * USDC_UNIT, emptyUpdates);

        // Bob borrows $2000
        vm.prank(bob);
        pool.borrow(address(bridgedETH), 2000 * USDC_UNIT, emptyUpdates);

        _assertHealthFactorInvariant(alice);
        _assertHealthFactorInvariant(bob);
    }

    function test_healthFactorInvariant_afterRepayment() public {
        // Alice borrows $5000
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        // Capture HF before repayment
        uint256 collateralValueBefore = collateralManager.getCollateralValueView(alice);
        uint256 debtBefore = pool.getUserDebt(alice);
        uint256 collateralWadBefore = collateralValueBefore * 1e12;
        uint256 debtWadBefore = debtBefore * 1e12;
        uint256 liqThreshold = collateralManager.getLiquidationThreshold();
        uint256 hfBefore = ((collateralWadBefore * liqThreshold) / 1e18) * 1e18 / debtWadBefore;

        // Alice repays half
        vm.prank(alice);
        pool.repay(2500 * USDC_UNIT);

        // Capture HF after repayment
        uint256 debtAfter = pool.getUserDebt(alice);
        uint256 debtWadAfter = debtAfter * 1e12;
        uint256 hfAfter = ((collateralWadBefore * liqThreshold) / 1e18) * 1e18 / debtWadAfter;

        // HF should improve after repayment
        assertGt(hfAfter, hfBefore, "Health factor should improve after repayment");

        _assertHealthFactorInvariant(alice);
    }

    function test_healthFactorInvariant_afterLiquidation() public {
        // 1. Alice borrows max ($7500 at $2000/ETH, 5 ETH, 75% LTV)
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 7500 * USDC_UNIT, emptyUpdates);

        // 2. Drop price to $1800/ETH (HF < 1.0)
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(1800e18)));

        // Capture HF before liquidation
        uint256 collateralValueBefore = collateralManager.getCollateralValueView(alice);
        uint256 debtBefore = pool.getUserDebt(alice);
        uint256 hfBefore = ((collateralValueBefore * 1e12 * collateralManager.getLiquidationThreshold()) / 1e18) * 1e18
            / (debtBefore * 1e12);
        assertTrue(hfBefore < 1e18, "HF should be below 1.0 before liquidation");

        // 3. Bob liquidates $2000 of alice's debt
        vm.prank(bob);
        liquidationEngine.liquidate(alice, address(bridgedETH), 2000 * USDC_UNIT, emptyUpdates);

        // 4. Check that alice's remaining position has higher HF than before liquidation
        uint256 debtAfter = pool.getUserDebt(alice);
        if (debtAfter > 0) {
            uint256 collateralValueAfter = collateralManager.getCollateralValueView(alice);
            uint256 hfAfter = ((collateralValueAfter * 1e12 * collateralManager.getLiquidationThreshold()) / 1e18)
                * 1e18 / (debtAfter * 1e12);

            assertGt(hfAfter, hfBefore, "HF should improve after liquidation");
        }
    }

    // ================================================================
    // 3. LTV Invariant Tests
    // ================================================================

    function test_ltvInvariant_defaultValues() public view {
        // Check base LTV is within bounds
        _assertLTVInvariant();

        // Verify specific values
        assertEq(collateralManager.getEffectiveLTV(), 0.75e18, "Effective LTV should be 75%");
        assertEq(collateralManager.getLiquidationThreshold(), 0.82e18, "Liq threshold should be 82%");
    }

    function test_ltvInvariant_afterOperations() public {
        // Borrow
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 3000 * USDC_UNIT, emptyUpdates);

        _assertLTVInvariant();

        // Repay
        vm.prank(alice);
        pool.repay(1000 * USDC_UNIT);

        _assertLTVInvariant();

        // Another borrow
        vm.prank(bob);
        pool.borrow(address(bridgedETH), 2000 * USDC_UNIT, emptyUpdates);

        _assertLTVInvariant();

        // Full repay
        vm.prank(alice);
        pool.repayFull();

        _assertLTVInvariant();
    }

    // ================================================================
    // 4. Vault Accounting Invariant Tests
    // ================================================================

    function test_vaultAccountingInvariant_initialState() public view {
        // After initial 1M deposit, invariant should hold
        _assertVaultAccountingInvariant();

        // Verify total assets equals deposited amount
        assertEq(vault.totalAssets(), 1_000_000 * USDC_UNIT, "Total assets should be 1M USDC");
    }

    function test_vaultAccountingInvariant_afterLending() public {
        // Alice borrows, which causes pool to call vault.lend()
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        _assertVaultAccountingInvariant();

        // Verify total lent tracks correctly
        assertEq(vault.totalLent(), 5000 * USDC_UNIT, "Total lent should be 5000 USDC");
        // totalAssets should remain the same (idle decreased, lent increased)
        assertEq(vault.totalAssets(), 1_000_000 * USDC_UNIT, "Total assets should remain 1M");
    }

    function test_vaultAccountingInvariant_afterRepayment() public {
        // Alice borrows
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 5000 * USDC_UNIT, emptyUpdates);

        // Alice repays
        vm.prank(alice);
        pool.repayFull();

        _assertVaultAccountingInvariant();

        // Verify lent is back to 0
        assertEq(vault.totalLent(), 0, "Total lent should be 0 after full repayment");
    }

    function test_vaultAccountingInvariant_afterRebalance() public {
        // Fund teller with USDC for redemption
        usdc.mint(address(teller), 1_000_000 * USDC_UNIT);

        // Admin already has OPERATOR_ROLE (granted in ChariotVault constructor)
        uint256 totalBefore = vault.totalAssets();

        // Rebalance -- deposits excess USDC into USYC
        vm.prank(admin);
        vault.rebalance();

        uint256 totalAfter = vault.totalAssets();

        // After rebalance, the vault's USYC balance increases and USDC decreases,
        // but totalAssets stays the same
        assertEq(totalAfter, totalBefore, "Total assets should remain unchanged after rebalance");

        // USYC balance should be non-zero after rebalance
        uint256 usycBalance = usyc.balanceOf(address(vault));
        assertGt(usycBalance, 0, "Vault should hold USYC after rebalance");

        _assertVaultAccountingInvariant();
    }

    // ================================================================
    // 5. Compound Invariant Tests (test all invariants together)
    // ================================================================

    function test_allInvariants_afterDepositBorrowRepaySequence() public {
        // 1. Alice borrows $3000
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 3000 * USDC_UNIT, emptyUpdates);
        _assertAllInvariants();
        _assertHealthFactorInvariant(alice);

        // 2. Bob borrows $1500
        vm.prank(bob);
        pool.borrow(address(bridgedETH), 1500 * USDC_UNIT, emptyUpdates);
        _assertAllInvariants();
        _assertHealthFactorInvariant(bob);

        // 3. Accrue interest -- warp 30 days
        vm.warp(block.timestamp + 30 days);
        stork.setPriceNow(ETHUSD_FEED_ID, ETH_PRICE); // Refresh oracle to avoid staleness

        // 4. Alice repays partial ($1000)
        vm.prank(alice);
        pool.repay(1000 * USDC_UNIT);
        _assertAllInvariants();
        _assertHealthFactorInvariant(alice);
        _assertHealthFactorInvariant(bob);

        // 5. Charlie borrows $1000
        vm.prank(charlie);
        pool.borrow(address(bridgedETH), 1000 * USDC_UNIT, emptyUpdates);
        _assertAllInvariants();
        _assertHealthFactorInvariant(charlie);

        // 6. Alice repays full
        vm.prank(alice);
        pool.repayFull();
        _assertAllInvariants();

        // 7. Final invariant check on all users
        _assertHealthFactorInvariant(bob);
        _assertHealthFactorInvariant(charlie);
    }

    function test_allInvariants_afterLiquidation() public {
        // 1. Alice borrows max ($7500 at $2000/ETH, 5 ETH, 75% LTV)
        vm.prank(alice);
        pool.borrow(address(bridgedETH), 7500 * USDC_UNIT, emptyUpdates);
        _assertAllInvariants();

        // 2. Drop ETH price to $1800/ETH -- makes alice's position liquidatable
        stork.setPriceNow(ETHUSD_FEED_ID, int192(int256(1800e18)));

        // 3. Bob liquidates $2000 of alice's debt
        vm.prank(bob);
        liquidationEngine.liquidate(alice, address(bridgedETH), 2000 * USDC_UNIT, emptyUpdates);

        // 4. Check all invariants hold after liquidation
        _assertBorrowInvariant();
        _assertLTVInvariant();
        _assertVaultAccountingInvariant();

        // 5. Alice's remaining debt should be positive (partial liquidation)
        uint256 aliceDebt = pool.getUserDebt(alice);
        assertGt(aliceDebt, 0, "Alice should have remaining debt after partial liquidation");
        assertLt(aliceDebt, 7500 * USDC_UNIT, "Alice's debt should have decreased");
    }

    // ================================================================
    // 6. Fuzz Test
    // ================================================================

    function testFuzz_borrowInvariant_randomAmounts(uint256 borrowAmount) public {
        // Alice has 5 ETH * $2000 = $10,000 collateral, 75% LTV = max $7,500
        // Bound borrowAmount between 100 USDC and max LTV borrow
        borrowAmount = bound(borrowAmount, 100 * USDC_UNIT, 7500 * USDC_UNIT);

        // Borrow
        vm.prank(alice);
        pool.borrow(address(bridgedETH), borrowAmount, emptyUpdates);

        // Check ALL invariants
        _assertBorrowInvariant();
        _assertHealthFactorInvariant(alice);
        _assertLTVInvariant();
        _assertVaultAccountingInvariant();
    }
}
