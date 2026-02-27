// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {ChariotVault} from "../src/core/ChariotVault.sol";
import {ChariotBase} from "../src/base/ChariotBase.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockStork} from "./mocks/MockStork.sol";
import {MockUSYCTeller} from "./mocks/MockUSYCTeller.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ChariotVaultRebalanceTest is Test {
    ChariotVault public vault;
    MockERC20 public usdc;
    MockERC20 public usyc;
    MockStork public stork;
    MockUSYCTeller public teller;

    address public admin = makeAddr("admin");
    address public operator = makeAddr("operator");
    address public alice = makeAddr("alice");

    uint256 constant USDC_UNIT = 1e6;
    uint256 constant INITIAL_USYC_PRICE = 1e18; // 1:1

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        usyc = new MockERC20("US Yield Coin", "USYC", 6);
        stork = new MockStork();
        teller = new MockUSYCTeller(address(usdc), address(usyc), INITIAL_USYC_PRICE);

        vault = new ChariotVault(
            address(usdc),
            address(usyc),
            address(teller),
            address(stork),
            admin
        );

        // Grant operator role
        bytes32 operatorRole = vault.OPERATOR_ROLE();
        vm.prank(admin);
        vault.grantRole(operatorRole, operator);

        // Fund alice and deposit
        usdc.mint(alice, 10_000 * USDC_UNIT);

        // Fund teller with USDC for redeem operations
        usdc.mint(address(teller), 1_000_000 * USDC_UNIT);
    }

    // ================================================================
    // Rebalance -- Deposit to USYC (AC: 1)
    // ================================================================

    function test_rebalance_depositsExcessToUSYC() public {
        // Alice deposits 10,000 USDC
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000 * USDC_UNIT);
        vault.deposit(10_000 * USDC_UNIT, alice);
        vm.stopPrank();

        // All 10,000 USDC is idle. Buffer = 5% = 500 USDC. Excess = 9,500 USDC.
        // Threshold = 100 USDC. 9,500 > 100 so rebalance should deposit.

        vm.prank(operator);
        vault.rebalance();

        // After rebalance: ~500 USDC idle, ~9,500 in USYC
        uint256 idleAfter = usdc.balanceOf(address(vault));
        uint256 usycBalAfter = usyc.balanceOf(address(vault));

        // Buffer should be approximately 5% of total assets
        assertApproxEqAbs(idleAfter, 500 * USDC_UNIT, 1 * USDC_UNIT);
        assertGt(usycBalAfter, 0);
    }

    function test_rebalance_maintainsFivePercentBuffer() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000 * USDC_UNIT);
        vault.deposit(10_000 * USDC_UNIT, alice);
        vm.stopPrank();

        vm.prank(operator);
        vault.rebalance();

        uint256 idleAfter = usdc.balanceOf(address(vault));
        uint256 total = vault.totalAssets();

        // Buffer should be exactly 5% (within rounding)
        uint256 expectedBuffer = (total * vault.BUFFER_PERCENT()) / 1e18;
        assertApproxEqAbs(idleAfter, expectedBuffer, 2 * USDC_UNIT);
    }

    function test_rebalance_emitsEventOnDeposit() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000 * USDC_UNIT);
        vault.deposit(10_000 * USDC_UNIT, alice);
        vm.stopPrank();

        vm.expectEmit(false, false, false, false);
        emit ChariotVault.Rebalanced(0, 0, 0); // Just check event fires
        vm.prank(operator);
        vault.rebalance();
    }

    // ================================================================
    // Rebalance -- Redeem USYC for Liquidity (AC: 2)
    // ================================================================

    function test_rebalance_redeemsUSYCWhenLiquidityNeeded() public {
        // Setup: deposit and rebalance to move USDC to USYC
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000 * USDC_UNIT);
        vault.deposit(10_000 * USDC_UNIT, alice);
        vm.stopPrank();

        vm.prank(operator);
        vault.rebalance();

        // Now simulate liquidity drain: remove most idle USDC
        // by lending to a mock lending pool
        bytes32 lpRole = vault.LENDING_POOL_ROLE();
        address mockPool = makeAddr("mockPool");
        vm.prank(admin);
        vault.grantRole(lpRole, mockPool);

        uint256 idleBefore = usdc.balanceOf(address(vault));
        if (idleBefore > 100 * USDC_UNIT) {
            vm.prank(mockPool);
            vault.lend(idleBefore - 50 * USDC_UNIT); // Leave only 50 USDC idle
        }

        // Now idle < buffer (50 < 500), so rebalance should redeem USYC
        vm.prank(operator);
        vault.rebalance();

        uint256 idleAfter = usdc.balanceOf(address(vault));
        // Should have restored buffer
        assertGt(idleAfter, 50 * USDC_UNIT);
    }

    // ================================================================
    // Rebalance -- Buffer Enforcement (AC: 3)
    // ================================================================

    function test_rebalance_noOpWhenWithinBuffer() public {
        // Deposit small amount where excess < threshold
        usdc.mint(alice, 200 * USDC_UNIT);
        vm.startPrank(alice);
        usdc.approve(address(vault), 200 * USDC_UNIT);
        vault.deposit(200 * USDC_UNIT, alice);
        vm.stopPrank();

        // 200 USDC total. Buffer = 10 USDC. Excess = 190 USDC.
        // But 190 > 100 threshold, so it WILL rebalance. Need smaller amount.
        // Actually with 200 USDC: buffer = 10, excess = 190, threshold = 100
        // 190 > 100 so it will rebalance. Let me use amount where excess < threshold.
        // Need excess < 100: totalAssets * 0.95 < 100 -> totalAssets < 105.26
        // So deposit 105 USDC: buffer = 5.25, excess = 99.75 < 100 threshold

        ChariotVault vault2 = new ChariotVault(
            address(usdc), address(usyc), address(teller), address(stork), admin
        );
        bytes32 opRole = vault2.OPERATOR_ROLE();
        vm.prank(admin);
        vault2.grantRole(opRole, operator);

        usdc.mint(alice, 105 * USDC_UNIT);
        vm.startPrank(alice);
        usdc.approve(address(vault2), 105 * USDC_UNIT);
        vault2.deposit(105 * USDC_UNIT, alice);
        vm.stopPrank();

        uint256 usycBefore = usyc.balanceOf(address(vault2));

        vm.prank(operator);
        vault2.rebalance();

        // No USYC should have been minted (within threshold)
        assertEq(usyc.balanceOf(address(vault2)), usycBefore);
    }

    // ================================================================
    // USYC Appreciation Model (AC: 5)
    // ================================================================

    function test_rebalance_usycAppreciationReflectsInTotalAssets() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000 * USDC_UNIT);
        vault.deposit(10_000 * USDC_UNIT, alice);
        vm.stopPrank();

        vm.prank(operator);
        vault.rebalance();

        uint256 totalBefore = vault.totalAssets();

        // Simulate 4.5% appreciation
        teller.setPrice(1.045e18);

        uint256 totalAfter = vault.totalAssets();

        // Total assets should increase due to USYC appreciation
        assertGt(totalAfter, totalBefore);
    }

    // ================================================================
    // Access Control (AC: 1, 2)
    // ================================================================

    function test_rebalance_revertsForNonOperator() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 100 * USDC_UNIT);
        vault.deposit(100 * USDC_UNIT, alice);
        vm.stopPrank();

        vm.expectRevert();
        vm.prank(alice);
        vault.rebalance();
    }

    function test_rebalance_revertsWhenUSYCNotConfigured() public {
        // Deploy vault without USYC
        ChariotVault noUsycVault = new ChariotVault(
            address(usdc), address(0), address(0), address(stork), admin
        );
        bytes32 opRole = noUsycVault.OPERATOR_ROLE();
        vm.prank(admin);
        noUsycVault.grantRole(opRole, operator);

        usdc.mint(alice, 1000 * USDC_UNIT);
        vm.startPrank(alice);
        usdc.approve(address(noUsycVault), 1000 * USDC_UNIT);
        noUsycVault.deposit(1000 * USDC_UNIT, alice);
        vm.stopPrank();

        vm.expectRevert(ChariotVault.USYCNotConfigured.selector);
        vm.prank(operator);
        noUsycVault.rebalance();
    }

    // ================================================================
    // Edge Cases
    // ================================================================

    function test_rebalance_emptyVaultNoOp() public {
        // No deposits -- totalAssets = 0
        vm.prank(operator);
        vault.rebalance(); // Should not revert, just no-op
    }

    function test_rebalance_allAssetsLentNoOp() public {
        // Deposit then lend all
        vm.startPrank(alice);
        usdc.approve(address(vault), 1000 * USDC_UNIT);
        vault.deposit(1000 * USDC_UNIT, alice);
        vm.stopPrank();

        bytes32 lpRole = vault.LENDING_POOL_ROLE();
        address mockPool = makeAddr("mockPool");
        vm.prank(admin);
        vault.grantRole(lpRole, mockPool);

        vm.prank(mockPool);
        vault.lend(1000 * USDC_UNIT);

        // All assets lent. Idle = 0, but total = 1000 (via _totalLent).
        // Buffer = 50 USDC. Idle (0) < Buffer (50). No USYC to redeem.
        vm.prank(operator);
        vault.rebalance(); // Should not revert
    }

    // ================================================================
    // Fuzz Tests
    // ================================================================

    function testFuzz_rebalance_bufferInvariant(uint256 depositAmount) public {
        depositAmount = bound(depositAmount, 1000 * USDC_UNIT, 500_000 * USDC_UNIT);

        usdc.mint(alice, depositAmount);
        vm.startPrank(alice);
        usdc.approve(address(vault), depositAmount);
        vault.deposit(depositAmount, alice);
        vm.stopPrank();

        vm.prank(operator);
        vault.rebalance();

        uint256 idle = usdc.balanceOf(address(vault));
        uint256 total = vault.totalAssets();

        if (total > 0) {
            // Idle should be approximately 5% of total
            uint256 expectedBuffer = (total * vault.BUFFER_PERCENT()) / 1e18;
            assertApproxEqAbs(idle, expectedBuffer, 2 * USDC_UNIT);
        }
    }
}
