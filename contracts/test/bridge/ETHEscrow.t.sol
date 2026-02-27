// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {ETHEscrow} from "../../src/bridge/ETHEscrow.sol";
import {IETHEscrow} from "../../src/interfaces/IETHEscrow.sol";

contract ETHEscrowTest is Test {
    ETHEscrow public escrow;

    address public relayer = makeAddr("relayer");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 constant ONE_ETH = 1 ether;
    uint256 constant REFUND_TIMEOUT = 86400; // 24 hours

    function setUp() public {
        escrow = new ETHEscrow(relayer);

        // Fund test accounts
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ================================================================
    // Constructor Tests
    // ================================================================

    function test_constructor_setsRelayer() public view {
        assertEq(escrow.getRelayer(), relayer);
    }

    function test_constructor_revertsZeroAddress() public {
        vm.expectRevert(IETHEscrow.Unauthorized.selector);
        new ETHEscrow(address(0));
    }

    function test_constructor_initialNonceIsZero() public view {
        assertEq(escrow.getCurrentNonce(), 0);
    }

    // ================================================================
    // Deposit Tests
    // ================================================================

    function test_deposit_locksETHAndEmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit IETHEscrow.Deposited(alice, ONE_ETH, 0);
        escrow.deposit{value: ONE_ETH}();

        assertEq(address(escrow).balance, ONE_ETH);

        IETHEscrow.DepositInfo memory info = escrow.getDeposit(0);
        assertEq(info.depositor, alice);
        assertEq(info.amount, ONE_ETH);
        assertEq(uint8(info.status), uint8(IETHEscrow.DepositStatus.Pending));
    }

    function test_deposit_incrementsNonce() public {
        vm.startPrank(alice);
        escrow.deposit{value: ONE_ETH}();
        assertEq(escrow.getCurrentNonce(), 1);

        escrow.deposit{value: 2 ether}();
        assertEq(escrow.getCurrentNonce(), 2);
        vm.stopPrank();

        IETHEscrow.DepositInfo memory info0 = escrow.getDeposit(0);
        assertEq(info0.amount, ONE_ETH);

        IETHEscrow.DepositInfo memory info1 = escrow.getDeposit(1);
        assertEq(info1.amount, 2 ether);
    }

    function test_deposit_revertsZeroValue() public {
        vm.prank(alice);
        vm.expectRevert(IETHEscrow.ZeroDeposit.selector);
        escrow.deposit{value: 0}();
    }

    function test_deposit_recordsTimestamp() public {
        uint256 ts = block.timestamp;
        vm.prank(alice);
        escrow.deposit{value: ONE_ETH}();

        IETHEscrow.DepositInfo memory info = escrow.getDeposit(0);
        assertEq(info.timestamp, ts);
    }

    // ================================================================
    // Refund Tests
    // ================================================================

    function test_refund_revertsBeforeTimeout() public {
        vm.prank(alice);
        escrow.deposit{value: ONE_ETH}();

        // Try to refund immediately
        vm.prank(alice);
        vm.expectRevert(IETHEscrow.RefundTooEarly.selector);
        escrow.refund(0);

        // Try just before timeout
        vm.warp(block.timestamp + REFUND_TIMEOUT - 1);
        vm.prank(alice);
        vm.expectRevert(IETHEscrow.RefundTooEarly.selector);
        escrow.refund(0);
    }

    function test_refund_succeedsAfterTimeout() public {
        vm.prank(alice);
        escrow.deposit{value: ONE_ETH}();

        uint256 balanceBefore = alice.balance;

        vm.warp(block.timestamp + REFUND_TIMEOUT);
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit IETHEscrow.Refunded(alice, ONE_ETH, 0);
        escrow.refund(0);

        assertEq(alice.balance, balanceBefore + ONE_ETH);
        assertEq(address(escrow).balance, 0);

        IETHEscrow.DepositInfo memory info = escrow.getDeposit(0);
        assertEq(uint8(info.status), uint8(IETHEscrow.DepositStatus.Refunded));
    }

    function test_refund_revertsIfAlreadyReleased() public {
        vm.prank(alice);
        escrow.deposit{value: ONE_ETH}();

        // Relayer releases
        vm.prank(relayer);
        escrow.release(alice, ONE_ETH, 0);

        // Try to refund after release
        vm.warp(block.timestamp + REFUND_TIMEOUT);
        vm.prank(alice);
        vm.expectRevert(IETHEscrow.AlreadyProcessed.selector);
        escrow.refund(0);
    }

    function test_refund_revertsIfAlreadyRefunded() public {
        vm.prank(alice);
        escrow.deposit{value: ONE_ETH}();

        vm.warp(block.timestamp + REFUND_TIMEOUT);
        vm.prank(alice);
        escrow.refund(0);

        // Try to refund again
        vm.prank(alice);
        vm.expectRevert(IETHEscrow.AlreadyProcessed.selector);
        escrow.refund(0);
    }

    function test_refund_revertsIfNotDepositor() public {
        vm.prank(alice);
        escrow.deposit{value: ONE_ETH}();

        vm.warp(block.timestamp + REFUND_TIMEOUT);
        vm.prank(bob);
        vm.expectRevert(IETHEscrow.Unauthorized.selector);
        escrow.refund(0);
    }

    function test_refund_revertsForNonexistentDeposit() public {
        vm.prank(alice);
        vm.expectRevert(IETHEscrow.DepositNotFound.selector);
        escrow.refund(999);
    }

    // ================================================================
    // Release Tests
    // ================================================================

    function test_release_succeedsFromRelayer() public {
        vm.prank(alice);
        escrow.deposit{value: ONE_ETH}();

        uint256 balanceBefore = alice.balance;

        vm.prank(relayer);
        vm.expectEmit(true, false, false, true);
        emit IETHEscrow.Released(alice, ONE_ETH, 0);
        escrow.release(alice, ONE_ETH, 0);

        assertEq(alice.balance, balanceBefore + ONE_ETH);
        assertEq(address(escrow).balance, 0);

        IETHEscrow.DepositInfo memory info = escrow.getDeposit(0);
        assertEq(uint8(info.status), uint8(IETHEscrow.DepositStatus.Released));
    }

    function test_release_revertsFromNonRelayer() public {
        vm.prank(alice);
        escrow.deposit{value: ONE_ETH}();

        vm.prank(alice);
        vm.expectRevert(IETHEscrow.Unauthorized.selector);
        escrow.release(alice, ONE_ETH, 0);
    }

    function test_release_revertsDoubleRelease() public {
        vm.prank(alice);
        escrow.deposit{value: 2 ether}();

        vm.prank(relayer);
        escrow.release(alice, 2 ether, 0);

        vm.prank(relayer);
        vm.expectRevert(IETHEscrow.AlreadyProcessed.selector);
        escrow.release(alice, 2 ether, 0);
    }

    function test_release_revertsForNonexistentDeposit() public {
        vm.prank(relayer);
        vm.expectRevert(IETHEscrow.DepositNotFound.selector);
        escrow.release(alice, ONE_ETH, 999);
    }

    function test_release_revertsWrongDepositor() public {
        vm.prank(alice);
        escrow.deposit{value: ONE_ETH}();

        vm.prank(relayer);
        vm.expectRevert(IETHEscrow.Unauthorized.selector);
        escrow.release(bob, ONE_ETH, 0);
    }

    function test_release_revertsWrongAmount() public {
        vm.prank(alice);
        escrow.deposit{value: ONE_ETH}();

        vm.prank(relayer);
        vm.expectRevert(IETHEscrow.Unauthorized.selector);
        escrow.release(alice, 2 ether, 0);
    }

    function test_refund_afterRelease_reverts() public {
        vm.prank(alice);
        escrow.deposit{value: ONE_ETH}();

        vm.prank(relayer);
        escrow.release(alice, ONE_ETH, 0);

        vm.warp(block.timestamp + REFUND_TIMEOUT);
        vm.prank(alice);
        vm.expectRevert(IETHEscrow.AlreadyProcessed.selector);
        escrow.refund(0);
    }

    // ================================================================
    // View Function Tests
    // ================================================================

    function test_getDeposit_returnsCorrectInfo() public {
        vm.prank(alice);
        escrow.deposit{value: 5 ether}();

        IETHEscrow.DepositInfo memory info = escrow.getDeposit(0);
        assertEq(info.depositor, alice);
        assertEq(info.amount, 5 ether);
        assertEq(uint8(info.status), uint8(IETHEscrow.DepositStatus.Pending));
    }

    function test_refundTimeout_isCorrect() public view {
        assertEq(escrow.REFUND_TIMEOUT(), 86400);
    }

    // ================================================================
    // Multiple Deposits Integration
    // ================================================================

    function test_multipleDeposits_trackedIndependently() public {
        vm.prank(alice);
        escrow.deposit{value: ONE_ETH}();

        vm.prank(bob);
        escrow.deposit{value: 3 ether}();

        assertEq(escrow.getCurrentNonce(), 2);
        assertEq(address(escrow).balance, 4 ether);

        // Release alice's deposit
        vm.prank(relayer);
        escrow.release(alice, ONE_ETH, 0);

        // Bob's deposit still pending
        IETHEscrow.DepositInfo memory bobInfo = escrow.getDeposit(1);
        assertEq(uint8(bobInfo.status), uint8(IETHEscrow.DepositStatus.Pending));
        assertEq(address(escrow).balance, 3 ether);

        // Refund bob's deposit after timeout
        vm.warp(block.timestamp + REFUND_TIMEOUT);
        vm.prank(bob);
        escrow.refund(1);

        assertEq(address(escrow).balance, 0);
    }
}
